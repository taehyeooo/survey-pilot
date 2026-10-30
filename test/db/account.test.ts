import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LEAVE_WORD, leaveAccount, previewLeave } from "../../src/lib/account";
import { hasDb, testUsers, type Db } from "./helpers";

// 탈퇴(multi-user R-7): 미리보기 → 확인 글자 → Auth 사용자까지 즉시 삭제 → 감사 기록. 운영자는 탈퇴할 수 없다.
describe.skipIf(!hasDb)("탈퇴 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  const purpose = `test-leave-${randomUUID().slice(0, 8)}`;
  const left: string[] = [];

  async function surveyWithResponse(ownerId: string) {
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: ownerId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug: `t${randomUUID().replace(/-/g, "").slice(0, 11)}` })
      .select("id")
      .single()
      .throwOnError();
    const { data: q } = await service.from("questions").insert({ survey_id: s.id, position: 1, type: "scale", prompt: "만족하나요?", options: [], required: true }).select("id").single().throwOnError();
    const { data: r } = await service
      .from("respondents")
      .insert({ survey_id: s.id, email_hash: `h-${randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    await service.rpc("submit_response", { p_survey_id: s.id, p_respondent_id: r.id, p_ip_hash: "ip", p_answers: [{ question_id: q.id, value: 3 }] }).throwOnError();
    return s.id as string;
  }

  beforeAll(() => {
    users = testUsers();
    service = users.service;
  });
  afterAll(async () => {
    await service?.from("usage_events").delete().eq("purpose", purpose);
    for (const id of left) await service.from("audit_logs").delete().eq("action", "leave").contains("detail", { user_id: id });
    await users?.cleanup();
  });

  // multi-user#R-7
  it("미리보기는 지워질 설문·응답 수를 보이고, 확인 글자가 다르면 지우지 않는다", async () => {
    const u = await users.signIn("leave-preview");
    await surveyWithResponse(u.id);
    await service.from("surveys").insert({ owner_id: u.id, problem: "스터디 출석률이 왜 떨어질까" }).throwOnError();
    expect(await previewLeave(service, u.id, undefined)).toEqual({ surveys: 2, responses: 1, protected: false });
    await expect(leaveAccount(service, { userId: u.id, confirm: "탈퇴할래요", adminEmail: undefined })).rejects.toThrow(LEAVE_WORD);
    expect((await service.from("profiles").select("id").eq("id", u.id)).data).toHaveLength(1);
  });

  // multi-user#R-7
  it("탈퇴하면 그 사용자의 설문·응답·응답자·프로필·Auth 사용자가 0, 사용 기록은 사용자만 비고, 감사 기록 1행", async () => {
    const u = await users.signIn("leave-now");
    const surveyId = await surveyWithResponse(u.id);
    const { data: usage } = await service.from("usage_events").insert({ kind: "ai", purpose, status: "ok", user_id: u.id, survey_id: surveyId }).select("id").single().throwOnError();

    left.push(u.id);
    await leaveAccount(service, { userId: u.id, confirm: ` ${LEAVE_WORD} `, adminEmail: undefined });

    const rows = async (table: string, column: string, value: string) => (await service.from(table).select("id", { count: "exact", head: true }).eq(column, value)).count;
    expect(await rows("surveys", "owner_id", u.id)).toBe(0);
    expect(await rows("responses", "survey_id", surveyId)).toBe(0);
    expect(await rows("respondents", "survey_id", surveyId)).toBe(0);
    expect(await rows("profiles", "id", u.id)).toBe(0);
    expect((await service.auth.admin.getUserById(u.id)).data.user).toBeNull();
    expect((await service.from("usage_events").select("user_id, survey_id").eq("id", usage.id).single()).data).toEqual({ user_id: null, survey_id: null });
    const { data: logs } = await service.from("audit_logs").select("action, actor_email, detail").eq("action", "leave").contains("detail", { user_id: u.id });
    expect(logs).toEqual([{ action: "leave", actor_email: "self", detail: { user_id: u.id, surveys: 1, responses: 1 } }]);
    expect(JSON.stringify(logs)).not.toContain(u.email); // 내부 번호만
  });

  // multi-user#R-7 — 운영자 계정은 탈퇴할 수 없다
  it("운영자는 탈퇴를 거부한다", async () => {
    const op = await users.signIn("leave-operator", { admin: true });
    expect((await previewLeave(service, op.id, op.email))!.protected).toBe(true);
    await expect(leaveAccount(service, { userId: op.id, confirm: LEAVE_WORD, adminEmail: op.email })).rejects.toThrow(/운영자/);
    expect((await service.auth.admin.getUserById(op.id)).data.user).not.toBeNull();
  });
});
