import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDaily } from "../../src/lib/cron";
import { createFakeAi } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const DAY = 864e5;
const report = {
  hypotheses: [{ index: 1, verdict: "unclear", evidence: "근거" }],
  answer: "답",
  next_actions: ["하나", "둘"],
  key_problems: [{ title: "문제", evidence: "근거" }],
  themes: [],
};

describe.skipIf(!hasDb)("하루 1회 크론 (실제 DB, 가짜 AI)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;

  async function survey(fields: Record<string, unknown>, emails: string[] = []) {
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`, status: "published", target_responses: 50, ...fields })
      .select("id")
      .single()
      .throwOnError();
    await service.from("hypotheses").insert({ survey_id: s.id, position: 1, statement: "시간이 안 맞는다" }).throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: s.id, position: 1, type: "scale", prompt: "만족?", options: [], required: true })
      .select("id")
      .single()
      .throwOnError();
    for (const email of emails) {
      const { data: r } = await service
        .from("respondents")
        .insert({ survey_id: s.id, email_hash: `h-${crypto.randomUUID()}`, email, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
        .select("id")
        .single()
        .throwOnError();
      await service.from("responses").insert({ survey_id: s.id, respondent_id: r.id }).throwOnError();
      const { data: resp } = await service.from("responses").select("id").eq("respondent_id", r.id).single();
      await service.from("answers").insert({ response_id: resp!.id, question_id: q.id, value: 3 }).throwOnError();
    }
    return s.id as string;
  }
  const emailsOf = async (id: string) => (await service.from("respondents").select("email").eq("survey_id", id)).data!.map((r) => r.email);

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-30
  it("마감 30일이 지난 설문만 이메일 원문을 지우고(해시는 남김), 29일 전 마감은 그대로", async () => {
    const now = Date.now();
    const old = await survey({ status: "closed", closed_at: new Date(now - 31 * DAY).toISOString(), close_reason: "manual" }, ["old@example.com"]);
    const recent = await survey({ status: "closed", closed_at: new Date(now - 29 * DAY).toISOString(), close_reason: "manual" }, ["recent@example.com"]);
    await service.from("reports").insert([old, recent].map((id) => ({ survey_id: id, kind: "final", response_count: 1, content: report, is_tentative: false }))).throwOnError();
    await runDaily(service, () => createFakeAi([]), now, { ownerId: adminId });
    expect(await emailsOf(old)).toEqual([null]);
    expect(await emailsOf(recent)).toEqual(["recent@example.com"]);
    expect((await service.from("respondents").select("email_hash").eq("survey_id", old)).data![0].email_hash).toMatch(/^h-/);
  });

  // survey-pilot#R-16 survey-pilot#R-24 multi-user#R-9(설문마다 AI를 받아 사용 기록에 설문을 남긴다)
  it("마감일 지난 진행 중 설문을 마감하고, 최종 리포트가 없으면 만든다", async () => {
    const id = await survey({ closes_at: new Date(Date.now() - 1000).toISOString() }, ["x@example.com"]);
    const ai = createFakeAi([report]);
    const asked: string[] = [];
    const result = await runDaily(service, (surveyId) => (asked.push(surveyId), ai), Date.now(), { ownerId: adminId });
    expect(asked).toContain(id);
    const { data } = await service.from("surveys").select("status, close_reason").eq("id", id).single();
    expect(data).toEqual({ status: "closed", close_reason: "deadline" });
    expect((await service.from("reports").select("kind").eq("survey_id", id)).data).toEqual([{ kind: "final" }]);
    expect(result.reports).toBeGreaterThanOrEqual(1);
  });

  // survey-pilot#R-30
  it("하루 지난 인증번호를 지운다(최근 것은 IP 제한·재발송 간격에 쓰여 남김)", async () => {
    const id = await survey({});
    const now = Date.now();
    await service
      .from("verifications")
      .insert([
        { survey_id: id, email_hash: "a", code_hash: "c", expires_at: new Date(now - 2 * DAY).toISOString(), sent_at: new Date(now - 2 * DAY).toISOString() },
        { survey_id: id, email_hash: "b", code_hash: "c", expires_at: new Date(now - 60_000).toISOString(), sent_at: new Date(now - 11 * 60_000).toISOString() },
      ])
      .throwOnError();
    await runDaily(service, () => createFakeAi([]), now, { ownerId: adminId });
    expect((await service.from("verifications").select("email_hash").eq("survey_id", id)).data).toEqual([{ email_hash: "b" }]);
  });
});
