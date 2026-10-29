import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeToken } from "../../src/lib/respond";
import { closeOverdue, closeSurvey, submitResponse } from "../../src/lib/submit";
import { anonKey, hasDb, testUsers, url, type Db } from "./helpers";

const secret = "test-secret";

describe.skipIf(!hasDb)("응답 제출·마감 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;
  let ipSeq = 0;

  async function liveSurvey(fields: Record<string, unknown> = {}) {
    const { data } = await service
      .from("surveys")
      .insert({
        owner_id: adminId,
        problem: "스터디 출석률이 왜 떨어질까",
        status: "published",
        slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`,
        target_responses: 3,
        closes_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        ...fields,
      })
      .select("id, status, archived_at, closes_at")
      .single()
      .throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: data.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "o1", label: "1번" }, { id: "o2", label: "2번" }], required: true })
      .select("id")
      .single()
      .throwOnError();
    return { survey: data, questionId: q.id as string };
  }
  async function verified(surveyId: string, email = `r${crypto.randomUUID().slice(0, 8)}@example.com`) {
    const { data } = await service
      .from("respondents")
      .insert({ survey_id: surveyId, email_hash: `h-${email}`, email, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    return makeToken(secret, data.id);
  }
  const answer = (questionId: string) => ({ [questionId]: ["o1"] });
  const status = async (id: string) => (await service.from("surveys").select("status, close_reason").eq("id", id).single()).data;
  const responses = async (id: string) => (await service.from("responses").select("id", { count: "exact", head: true }).eq("survey_id", id)).count;
  const ip = () => `10.1.0.${++ipSeq}`;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-19
  it("검사를 통과하면 응답 1건과 답을 한 번에 저장하고, 같은 응답자는 두 번 못 낸다", async () => {
    const { survey, questionId } = await liveSurvey({ target_responses: 10 });
    const token = await verified(survey.id);
    await expect(submitResponse(service, secret, { survey, token, raw: answer(questionId), ip: ip() })).resolves.toBe("ok");
    expect(await responses(survey.id)).toBe(1);
    const { data } = await service.from("answers").select("value, responses!inner(survey_id)").eq("responses.survey_id", survey.id);
    expect(data!.map((a) => a.value)).toEqual([["o1"]]);
    await expect(submitResponse(service, secret, { survey, token, raw: answer(questionId), ip: ip() })).rejects.toMatchObject({ code: "done" });
    expect(await responses(survey.id)).toBe(1);
  });

  // survey-pilot#R-19
  it("토큰이 없거나 위조·만료면, 없는 선택지면 저장하지 않는다", async () => {
    const { survey, questionId } = await liveSurvey();
    await expect(submitResponse(service, secret, { survey, token: "엉터리", raw: answer(questionId), ip: ip() })).rejects.toMatchObject({ code: "token" });
    const old = makeToken(secret, "x", Date.now() - 31 * 60_000);
    await expect(submitResponse(service, secret, { survey, token: old, raw: answer(questionId), ip: ip() })).rejects.toMatchObject({ code: "token" });
    const token = await verified(survey.id);
    await expect(submitResponse(service, secret, { survey, token, raw: { [questionId]: ["o9"] }, ip: ip() })).rejects.toMatchObject({ code: "invalid" });
    expect(await responses(survey.id)).toBe(0);
  });

  // survey-pilot#R-19
  it("다른 설문에서 받은 토큰으로는 제출할 수 없다", async () => {
    const a = await liveSurvey();
    const b = await liveSurvey();
    const tokenForA = await verified(a.survey.id);
    await expect(submitResponse(service, secret, { survey: b.survey, token: tokenForA, raw: answer(b.questionId), ip: ip() })).rejects.toMatchObject({ code: "token" });
    expect(await responses(b.survey.id)).toBe(0);
  });

  // survey-pilot#R-16
  it("목표 3이면 3번째 제출 뒤 마감(target)되고 4번째는 거부", async () => {
    const { survey, questionId } = await liveSurvey({ target_responses: 3 });
    for (let i = 0; i < 3; i++) await submitResponse(service, secret, { survey, token: await verified(survey.id), raw: answer(questionId), ip: ip() });
    expect(await status(survey.id)).toEqual({ status: "closed", close_reason: "target" });
    await expect(submitResponse(service, secret, { survey, token: await verified(survey.id), raw: answer(questionId), ip: ip() })).rejects.toMatchObject({ code: "closed" });
    expect(await responses(survey.id)).toBe(3);
  });

  // survey-pilot#R-16
  it("남은 자리가 1개일 때 동시에 2건이 오면 1건만 저장한다", async () => {
    const { survey, questionId } = await liveSurvey({ target_responses: 1 });
    const [a, b] = await Promise.all([verified(survey.id), verified(survey.id)]);
    const results = await Promise.allSettled([
      submitResponse(service, secret, { survey, token: a, raw: answer(questionId), ip: ip() }),
      submitResponse(service, secret, { survey, token: b, raw: answer(questionId), ip: ip() }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await responses(survey.id)).toBe(1);
  });

  // survey-pilot#R-16
  it("마감일이 지났으면 제출을 거부하고 마감(deadline)한다, 접근 때 몰아서 마감도 한다", async () => {
    const { survey, questionId } = await liveSurvey();
    await service.from("surveys").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("id", survey.id);
    await expect(
      submitResponse(service, secret, { survey: { ...survey, closes_at: null }, token: await verified(survey.id), raw: answer(questionId), ip: ip() }),
    ).rejects.toMatchObject({ code: "closed" });
    expect(await status(survey.id)).toEqual({ status: "closed", close_reason: "deadline" });

    const other = await liveSurvey();
    await service.from("surveys").update({ closes_at: new Date(Date.now() - 1000).toISOString() }).eq("id", other.survey.id);
    await closeOverdue(service);
    expect(await status(other.survey.id)).toEqual({ status: "closed", close_reason: "deadline" });
  });

  // survey-pilot#R-16
  it("관리자가 수동으로 마감한다", async () => {
    const { survey } = await liveSurvey();
    await closeSurvey(service, survey);
    expect(await status(survey.id)).toEqual({ status: "closed", close_reason: "manual" });
  });

  // survey-pilot#R-31 — 제출 함수는 서버만 부른다(검사를 건너뛴 저장 막기)
  it("공개 키(anon)로는 제출 함수를 부를 수 없다", async () => {
    const { survey, questionId } = await liveSurvey();
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("submit_response", { p_survey_id: survey.id, p_respondent_id: survey.id, p_ip_hash: "x", p_answers: [{ question_id: questionId, value: ["o1"] }] });
    expect(error).not.toBeNull();
    expect(await responses(survey.id)).toBe(0);
  });

  // survey-pilot#R-4
  it("같은 IP에서 1시간에 제출 10회까지", async () => {
    const { survey, questionId } = await liveSurvey({ target_responses: 50 });
    const sameIp = ip();
    for (let i = 0; i < 10; i++) await submitResponse(service, secret, { survey, token: await verified(survey.id), raw: answer(questionId), ip: sameIp });
    await expect(submitResponse(service, secret, { survey, token: await verified(survey.id), raw: answer(questionId), ip: sameIp })).rejects.toMatchObject({ code: "ip" });
    expect(await responses(survey.id)).toBe(10);
  });
});
