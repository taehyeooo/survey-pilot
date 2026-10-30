import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "../../src/lib/design";
import { generateReport, latestReport } from "../../src/lib/report";
import { createFakeAi } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const output = (count = 2) => ({
  hypotheses: Array.from({ length: count }, (_, i) => ({ index: i + 1, verdict: i === 0 ? "supported" : "unclear", evidence: "근거" })),
  answer: "저녁 7시 시작이 원인으로 보인다.",
  next_actions: ["시작 시간을 옮긴다", "한 달 뒤 다시 본다"],
  headline: "한 줄 결론",
  key_problems: [{ title: "시간이 안 맞는다", evidence: "근거 수치" }],
  themes: [{ title: "퇴근", summary: "퇴근 직후라 어렵다", quotes: ["퇴근 시간이라 힘들어요"] }],
});

describe.skipIf(!hasDb)("문제 답변 리포트 (실제 DB, 가짜 AI)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;

  async function surveyWithResponses(n: number, target = 5) {
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", purpose: "원인", status: "published", slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`, target_responses: target })
      .select("id")
      .single()
      .throwOnError();
    const { data: hs } = await service
      .from("hypotheses")
      .insert([
        { survey_id: s.id, position: 1, statement: "시간이 안 맞는다" },
        { survey_id: s.id, position: 2, statement: "교재가 어렵다" },
      ])
      .select("id, position")
      .throwOnError();
    const { data: qs } = await service
      .from("questions")
      .insert([
        { survey_id: s.id, position: 1, type: "scale", prompt: "시간이 맞나요?", options: [], required: true, hypothesis_id: hs.find((h) => h.position === 1)!.id },
        { survey_id: s.id, position: 2, type: "text", prompt: "더 하고 싶은 말", options: [], required: false },
      ])
      .select("id, position")
      .throwOnError();
    for (let i = 0; i < n; i++) await addResponse(s.id, qs, i);
    return { id: s.id as string, qs };
  }
  async function addResponse(surveyId: string, qs: { id: string; position: number }[], i: number) {
    const { data: r } = await service
      .from("respondents")
      .insert({ survey_id: surveyId, email_hash: `h-${crypto.randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    const answers = [{ question_id: qs.find((q) => q.position === 1)!.id, value: (i % 5) + 1 }];
    if (i === 0) answers.push({ question_id: qs.find((q) => q.position === 2)!.id, value: "퇴근 시간이라 힘들어요" as never });
    await service.rpc("submit_response", { p_survey_id: surveyId, p_respondent_id: r.id, p_ip_hash: `ip-${crypto.randomUUID()}`, p_answers: answers }).throwOnError();
  }

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-24
  it("응답이 목표보다 적으면 참고용, 같은 응답 수로 다시 부르면 AI를 부르지 않는다", async () => {
    const { id } = await surveyWithResponses(2);
    const ai = createFakeAi([output()]);
    const first = await generateReport(service, ai, id, "interim");
    expect(first).toMatchObject({ kind: "interim", response_count: 2, is_tentative: true });
    const again = await generateReport(service, ai, id, "interim");
    expect(again.id).toBe(first.id);
    expect(ai.prompts).toHaveLength(1);
  });

  // survey-pilot#R-24
  it("응답이 늘면 새로 만들고, 가장 최근 리포트를 보여 준다(최종이 있으면 최종)", async () => {
    const { id, qs } = await surveyWithResponses(2, 3);
    const ai = createFakeAi([output(), output(), output()]);
    await generateReport(service, ai, id, "interim");
    await addResponse(id, qs, 1); // 3번째 → 목표 3 도달로 마감
    const final = await generateReport(service, ai, id, "final");
    expect(final).toMatchObject({ kind: "final", response_count: 3, is_tentative: false });
    expect((await latestReport(service, id))?.id).toBe(final.id);
    expect(ai.prompts).toHaveLength(2);
  });

  // survey-pilot#R-23 survey-pilot#R-32
  it("주관식 원문이 프롬프트의 <texts> 안에 들어가고, 인용은 원문만 저장한다", async () => {
    const { id } = await surveyWithResponses(1);
    const ai = createFakeAi([{ ...output(), themes: [{ title: "퇴근", summary: "s", quotes: ["퇴근 시간이라 힘들어요", "지어낸 말"] }] }]);
    const report = await generateReport(service, ai, id, "interim");
    expect(ai.prompts[0]).toMatch(/<texts>[\s\S]*퇴근 시간이라 힘들어요[\s\S]*<\/texts>/);
    expect(report.content.themes[0].quotes).toEqual(["퇴근 시간이라 힘들어요"]);
  });

  // survey-pilot#R-24
  it("응답이 없으면 리포트를 만들지 않는다", async () => {
    const { id } = await surveyWithResponses(0);
    await expect(generateReport(service, createFakeAi([]), id, "interim")).rejects.toBeInstanceOf(ConflictError);
  });

  // survey-pilot#R-33 — 핵심 문제가 없는 옛 리포트는 같은 행을 다시 채운다
  it("결론 한 줄·핵심 문제가 없는 옛 리포트는 AI를 다시 불러 같은 행을 고친다", async () => {
    const { id } = await surveyWithResponses(2);
    const { key_problems: _drop, headline: _h, ...old } = output();
    void _h;
    void _drop;
    await service.from("reports").insert({ survey_id: id, kind: "interim", response_count: 2, content: old, is_tentative: true }).throwOnError();
    const ai = createFakeAi([output()]);
    const report = await generateReport(service, ai, id, "interim");
    expect(ai.prompts).toHaveLength(1);
    expect(report.content.key_problems).toEqual(output().key_problems);
    const { count } = await service.from("reports").select("id", { count: "exact", head: true }).eq("survey_id", id).throwOnError();
    expect(count).toBe(1);
    // 이제 핵심 문제가 있으니 다시 부르지 않는다
    const again = createFakeAi([]);
    await generateReport(service, again, id, "interim");
    expect(again.prompts).toHaveLength(0);
  });
});
