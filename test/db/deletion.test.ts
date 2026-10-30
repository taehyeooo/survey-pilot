import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteOwnRespondent, deleteRespondent, deleteResponsesByEmail, findRespondent, findResponsesByEmail } from "../../src/lib/deletion";
import { emailHashOf } from "../../src/lib/respond";
import { hasDb, testUsers, type Db } from "./helpers";

const secret = "test-secret";

describe.skipIf(!hasDb)("응답 삭제 요청 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;
  let otherId: string;

  async function surveyWith(emails: string[], { forgetEmail = false, ownerId = adminId } = {}) {
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: ownerId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`, target_responses: 50 })
      .select("id")
      .single()
      .throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: s.id, position: 1, type: "scale", prompt: "만족하나요?", options: [], required: true })
      .select("id")
      .single()
      .throwOnError();
    for (const email of emails) {
      const { data: r } = await service
        .from("respondents")
        .insert({ survey_id: s.id, email_hash: emailHashOf(secret, email), email: forgetEmail ? null : email, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
        .select("id")
        .single()
        .throwOnError();
      await service.rpc("submit_response", { p_survey_id: s.id, p_respondent_id: r.id, p_ip_hash: "ip", p_answers: [{ question_id: q.id, value: 3 }] }).throwOnError();
    }
    return s.id as string;
  }
  const count = async (table: string, surveyId: string) =>
    (await service.from(table).select("id", { count: "exact", head: true }).eq("survey_id", surveyId)).count;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
    ({ id: otherId } = await users.signIn("other-owner"));
  });
  afterAll(async () => {
    await service?.from("audit_logs").delete().eq("actor_email", "admin-test@example.com");
    await users?.cleanup();
  });

  // survey-pilot#R-26
  it("이메일(대소문자 무관)로 찾고, 원문이 지워진 뒤에도 해시로 찾는다, 다른 설문 응답은 안 찾는다", async () => {
    const id = await surveyWith(["a@example.com"]);
    expect(await findRespondent(service, secret, id, " A@Example.com ")).toMatchObject({ answers: 1 });
    const forgotten = await surveyWith(["b@example.com"], { forgetEmail: true });
    expect(await findRespondent(service, secret, forgotten, "b@example.com")).not.toBeNull();
    expect(await findRespondent(service, secret, id, "b@example.com")).toBeNull();
  });

  // survey-pilot#R-26
  it("사유 없이는 지우지 않는다", async () => {
    const id = await surveyWith(["c@example.com"]);
    const found = await findRespondent(service, secret, id, "c@example.com");
    await expect(deleteRespondent(service, { surveyId: id, respondentId: found!.id, reason: "  ", actorEmail: "admin-test@example.com" })).rejects.toThrow(/사유/);
    expect(await count("responses", id)).toBe(1);
  });

  // survey-pilot#R-26
  it("지우면 응답·답·응답자가 사라지고 집계는 N-1, 감사 기록 1행(이메일은 해시만)", async () => {
    const id = await surveyWith(["d@example.com", "e@example.com", "f@example.com"]);
    const found = await findRespondent(service, secret, id, "e@example.com");
    await deleteRespondent(service, { surveyId: id, respondentId: found!.id, reason: "응답자 본인 요청(메일)", actorEmail: "admin-test@example.com" });
    expect(await count("responses", id)).toBe(2);
    expect(await count("respondents", id)).toBe(2);
    expect(await findRespondent(service, secret, id, "e@example.com")).toBeNull();
    const { data: logs } = await service.from("audit_logs").select("action, reason, detail").eq("survey_id", id);
    expect(logs).toEqual([{ action: "delete_response", reason: "응답자 본인 요청(메일)", detail: { email_hash: emailHashOf(secret, "e@example.com") } }]);
    expect(JSON.stringify(logs)).not.toContain("e@example.com");
  });

  // multi-user#R-15 — 운영자는 어느 사용자의 설문이든 이메일로 찾아 지운다
  it("운영자: 이메일로 모든 사용자의 설문에서 찾고(제목·건수만), 사유와 함께 지우면 설문마다 감사 기록", async () => {
    const email = `g-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const mine = await surveyWith([email, "h@example.com"]);
    const theirs = await surveyWith([email], { ownerId: otherId });
    const unsent = await surveyWith([], { ownerId: otherId }); // 인증만 하고 내지 않은 설문은 지울 응답이 없다
    await service.from("respondents").insert({ survey_id: unsent, email_hash: emailHashOf(secret, email), consented_at: new Date().toISOString(), verified_at: new Date().toISOString() }).throwOnError();
    const found = await findResponsesByEmail(service, secret, ` ${email.toUpperCase()} `);
    expect(found.map((f) => f.surveyId).sort()).toEqual([mine, theirs].sort());
    expect(Object.keys(found[0]).sort()).toEqual(["problem", "respondentId", "surveyId"]);

    await expect(deleteResponsesByEmail(service, secret, { email, expected: 2, reason: "", actorEmail: "admin-test@example.com" })).rejects.toThrow(/사유/);
    await expect(deleteResponsesByEmail(service, secret, { email, expected: 1, reason: "본인 요청", actorEmail: "admin-test@example.com" })).rejects.toThrow(/다시 찾/);
    expect(await count("responses", theirs)).toBe(1);

    expect(await deleteResponsesByEmail(service, secret, { email, expected: 2, reason: "본인 요청", actorEmail: "admin-test@example.com" })).toBe(2);
    expect(await count("responses", theirs)).toBe(0);
    expect(await count("responses", mine)).toBe(1); // 다른 응답자는 그대로
    const { data: logs } = await service.from("audit_logs").select("action, survey_id").in("survey_id", [mine, theirs]);
    expect(logs!.map((l) => l.survey_id).sort()).toEqual([mine, theirs].sort());
    expect(await findResponsesByEmail(service, secret, email)).toEqual([]);
  });

  // multi-user#R-16 — 설문 주인은 자기 설문에서만
  it("주인: 남의 설문 응답은 지우지 못한다", async () => {
    const theirs = await surveyWith(["i@example.com"], { ownerId: otherId });
    const found = await findRespondent(service, secret, theirs, "i@example.com");
    await expect(
      deleteOwnRespondent(service, adminId, { surveyId: theirs, respondentId: found!.id, reason: "본인 요청", actorEmail: "admin-test@example.com" }),
    ).rejects.toThrow(/찾을 수 없/);
    expect(await count("responses", theirs)).toBe(1);
    await deleteOwnRespondent(service, otherId, { surveyId: theirs, respondentId: found!.id, reason: "본인 요청", actorEmail: "other@example.com" });
    expect(await count("responses", theirs)).toBe(0);
    await service.from("audit_logs").delete().eq("actor_email", "other@example.com");
  });
});
