import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAllSurveys, OPS_COLUMNS, previewSuspension, previewTakedown, setSuspension, setTakedown } from "../../src/lib/moderation";
import { findPublicSurvey } from "../../src/lib/publish";
import { makeToken } from "../../src/lib/respond";
import { submitResponse } from "../../src/lib/submit";
import { restoreSurvey } from "../../src/lib/surveys";
import { hasDb, testUsers, type Db } from "./helpers";

const secret = "test-secret";

// 운영 조치(multi-user R-12, R-14): 미리보기 → 사유 → 실행 → 감사 기록(ADR 0012).
describe.skipIf(!hasDb)("정지·해제와 설문 내리기 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let op: { id: string; email: string };
  let owner: { id: string; email: string; client: Db };

  const audits = async (filter: { survey_id?: string; user_id?: string }) => {
    let q = service.from("audit_logs").select("action, actor_email, reason, detail, survey_id");
    if (filter.survey_id) q = q.eq("survey_id", filter.survey_id);
    if (filter.user_id) q = q.contains("detail", { user_id: filter.user_id });
    return (await q.order("created_at").throwOnError()).data ?? [];
  };

  async function liveSurvey() {
    const slug = `t${randomUUID().replace(/-/g, "").slice(0, 11)}`;
    const { data } = await service
      .from("surveys")
      .insert({ owner_id: owner.id, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug, closes_at: new Date(Date.now() + 864e5).toISOString() })
      .select("id, slug")
      .single()
      .throwOnError();
    return data as { id: string; slug: string };
  }

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    op = await users.signIn("mod-operator", { admin: true });
    owner = await users.signIn("mod-owner");
  });
  afterAll(async () => {
    await service?.from("audit_logs").delete().eq("actor_email", op?.email ?? "");
    await users?.cleanup();
  });

  // multi-user#R-12
  it("정지 미리보기는 닫힐 응답 링크 수를 보이고 아무것도 바꾸지 않는다", async () => {
    await liveSurvey();
    await service.from("surveys").insert({ owner_id: owner.id, problem: "스터디 출석률이 왜 떨어질까" }).throwOnError(); // 게시 전은 링크가 없다
    const down = await liveSurvey();
    await service.from("surveys").update({ taken_down_at: new Date().toISOString(), takedown_reason: "이미 내림" }).eq("id", down.id).throwOnError(); // 이미 닫힌 링크
    const preview = await previewSuspension(service, owner.id, op.email);
    expect(preview).toMatchObject({ email: owner.email, suspended: false, openLinks: 1, protected: false });
    expect((await service.from("profiles").select("suspended_at").eq("id", owner.id).single()).data!.suspended_at).toBeNull();
  });

  // multi-user#R-12
  it("정지·해제는 사유를 받고 감사 기록을 1행씩 남긴다, 사유가 없으면 거부", async () => {
    await expect(setSuspension(service, { userId: owner.id, suspend: true, reason: "  ", actorEmail: op.email, adminEmail: op.email })).rejects.toThrow(/사유/);
    await setSuspension(service, { userId: owner.id, suspend: true, reason: "한도 남용", actorEmail: op.email, adminEmail: op.email });
    const { data } = await service.from("profiles").select("suspended_at, suspend_reason").eq("id", owner.id).single().throwOnError();
    expect(data.suspended_at).not.toBeNull();
    expect(data.suspend_reason).toBe("한도 남용");
    await setSuspension(service, { userId: owner.id, suspend: false, reason: "소명 확인", actorEmail: op.email, adminEmail: op.email });
    expect((await service.from("profiles").select("suspended_at, suspend_reason").eq("id", owner.id).single()).data).toEqual({ suspended_at: null, suspend_reason: null });
    expect((await audits({ user_id: owner.id })).map((a) => [a.action, a.reason, a.actor_email])).toEqual([
      ["suspend_user", "한도 남용", op.email],
      ["unsuspend_user", "소명 확인", op.email],
    ]);
  });

  // multi-user#R-12 — 운영자(자신 포함)는 정지할 수 없다
  it("운영자 정지는 거부하고 기록도 남기지 않는다", async () => {
    expect((await previewSuspension(service, op.id, op.email))!.protected).toBe(true);
    expect((await previewSuspension(service, owner.id, owner.email))!.protected).toBe(true); // admins에 없어도 ADMIN_EMAIL이면
    await expect(setSuspension(service, { userId: op.id, suspend: true, reason: "실수", actorEmail: op.email, adminEmail: op.email })).rejects.toThrow(/운영자/);
    expect(await audits({ user_id: op.id })).toEqual([]);
  });

  // multi-user#R-14 — 운영자는 목록·숫자만 본다
  it("전체 설문 목록에는 제목·주인 이메일·상태·응답 수만 있고 문항·답 필드는 없다", async () => {
    const s = await liveSurvey();
    const row = (await listAllSurveys(service)).find((r) => r.id === s.id);
    expect(OPS_COLUMNS).not.toMatch(/questions|answers|respondents|reports|hypotheses|\*/);
    expect(Object.keys(row!).sort()).toEqual(["id", "ownerEmail", "problem", "responses", "status", "takenDown"]);
    expect(row).toMatchObject({ ownerEmail: owner.email, status: "published", responses: 0, takenDown: false });
  });

  // multi-user#R-14
  it("내리면 응답 링크가 닫히고 주인은 되돌릴 수 없으며, 운영자가 되돌리면 다시 받는다", async () => {
    const s = await liveSurvey();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: s.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "o1", label: "1번" }, { id: "o2", label: "2번" }], required: true })
      .select("id")
      .single()
      .throwOnError();
    const { data: r } = await service
      .from("respondents")
      .insert({ survey_id: s.id, email_hash: `h-${randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    const token = makeToken(secret, r.id);
    const raw = { [q.id]: ["o1"] };

    expect(await previewTakedown(service, s.id)).toMatchObject({ ownerEmail: owner.email, status: "published", responses: 0, takenDown: false });
    await expect(setTakedown(service, { surveyId: s.id, takeDown: true, reason: "", actorEmail: op.email })).rejects.toThrow(/사유/);
    await setTakedown(service, { surveyId: s.id, takeDown: true, reason: "광고 설문", actorEmail: op.email });
    const down = (await findPublicSurvey(service, s.slug))!;
    expect(down.paused).toBe(true);
    await expect(submitResponse(service, secret, { survey: down, token, raw, ip: "10.8.0.1" })).rejects.toMatchObject({ code: "closed" });

    // 주인: 세션으로는 쓸 수 없고, 보관함 복원은 내린 것을 풀지 않는다
    await owner.client.from("surveys").update({ taken_down_at: null, takedown_reason: null }).eq("id", s.id);
    await restoreSurvey(service, owner.id, s.id);
    expect((await service.from("surveys").select("taken_down_at").eq("id", s.id).single()).data!.taken_down_at).not.toBeNull();

    await setTakedown(service, { surveyId: s.id, takeDown: false, reason: "오해 확인", actorEmail: op.email });
    const up = (await findPublicSurvey(service, s.slug))!;
    expect(up.paused).toBe(false);
    await expect(submitResponse(service, secret, { survey: up, token, raw, ip: "10.8.0.2" })).resolves.toBe("ok");
    expect((await audits({ survey_id: s.id })).map((a) => [a.action, a.reason])).toEqual([
      ["take_down_survey", "광고 설문"],
      ["restore_survey", "오해 확인"],
    ]);
  });
});
