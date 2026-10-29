import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadResults, toCsv } from "../../src/lib/results";
import { hasDb, testUsers, type Db } from "./helpers";

describe.skipIf(!hasDb)("결과 집계 건수 검증 (실제 DB, 관리자 세션)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let admin: Db;
  let adminId: string;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ client: admin, id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-21 survey-pilot#R-22 survey-pilot#R-25
  it("응답 N건 → 진행 현황 N, 하나 고르기 합계 N, CSV N줄", async () => {
    const { data: survey } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`, target_responses: 30 })
      .select("id")
      .single()
      .throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: survey.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "o1", label: "1번" }, { id: "o2", label: "2번" }], required: true })
      .select("id")
      .single()
      .throwOnError();
    const N = 7;
    for (let i = 0; i < N; i++) {
      const { data: r } = await service
        .from("respondents")
        .insert({ survey_id: survey.id, email_hash: `h-${crypto.randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
        .select("id")
        .single()
        .throwOnError();
      await service.rpc("submit_response", { p_survey_id: survey.id, p_respondent_id: r.id, p_ip_hash: `ip-${i}`, p_answers: [{ question_id: q.id, value: [i % 3 === 0 ? "o2" : "o1"] }] }).throwOnError();
    }

    const results = await loadResults(admin, survey.id);
    expect(results.responseCount).toBe(N);
    const [single] = results.stats;
    expect(single.kind === "choice" && single.options.reduce((s, o) => s + o.count, 0)).toBe(N);
    const csv = toCsv(results.questions, results.responses, results.answers);
    expect(csv.slice(1).trimEnd().split("\r\n")).toHaveLength(N + 1);
  });
});
