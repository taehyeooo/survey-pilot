import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasDb, testUsers, type Db } from "./helpers";

// 여러 사용자 데이터 모델과 RLS(multi-user spec, ADR 0019 v2·0020).
describe.skipIf(!hasDb)("여러 사용자 — 프로필과 설문 분리 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let a: { client: Db; id: string; email: string };
  let b: { client: Db; id: string; email: string };

  async function surveyOf(ownerId: string) {
    const { data: survey } = await service
      .from("surveys")
      .insert({ owner_id: ownerId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug: `t-${randomUUID()}` })
      .select("id")
      .single()
      .throwOnError();
    await service
      .from("questions")
      .insert({ survey_id: survey.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "a", label: "1번" }, { id: "b", label: "2번" }] })
      .throwOnError();
    return survey.id as string;
  }

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    a = await users.signIn("mu-a");
    b = await users.signIn("mu-b");
  });

  afterAll(async () => {
    await users?.cleanup();
  });

  // multi-user#R-17 — Auth 사용자가 생기면 프로필이 따라 생긴다(가입 경로와 상관없이)
  it("Auth 사용자마다 프로필 1행, 이메일은 소문자, 동의·정지 전", async () => {
    const { data } = await service.from("profiles").select("id, email, agreed_at, suspended_at").in("id", [a.id, b.id]).throwOnError();
    expect(data).toHaveLength(2);
    expect(data!.find((p) => p.id === a.id)).toMatchObject({ email: a.email.toLowerCase(), agreed_at: null, suspended_at: null });
  });

  // multi-user#R-17 — 기존 설문은 모두 프로필이 있는 주인을 가리킨다
  it("모든 설문의 주인에게 프로필이 있다", async () => {
    const { data: surveys } = await service.from("surveys").select("owner_id").throwOnError();
    const owners = [...new Set(surveys!.map((s) => s.owner_id))];
    const { data: profiles } = await service.from("profiles").select("id").in("id", owners).throwOnError();
    expect(profiles).toHaveLength(owners.length);
  });

  // multi-user#R-3
  it("자기 설문과 하위 행만 읽고, 남의 것은 0행", async () => {
    const mine = await surveyOf(a.id);
    const theirs = await surveyOf(b.id);
    expect((await a.client.from("surveys").select("id").eq("id", mine)).data).toHaveLength(1);
    expect((await a.client.from("questions").select("id").eq("survey_id", mine)).data).toHaveLength(1);
    expect((await a.client.from("surveys").select("id").eq("id", theirs)).data).toEqual([]);
    expect((await a.client.from("questions").select("id").eq("survey_id", theirs)).data).toEqual([]);
  });

  // multi-user#R-3 — 쓰기는 서버만. 공개 키로 상태·내림 표시를 바꾸지 못한다(ADR 0019 v2)
  it("로그인 사용자는 설문을 직접 만들거나 고치거나 지우지 못한다", async () => {
    const mine = await surveyOf(a.id);
    const insert = await a.client.from("surveys").insert({ owner_id: a.id, problem: "공개 키로 직접 만든 설문" });
    expect(insert.error).not.toBeNull();
    const update = await a.client.from("surveys").update({ archived_at: new Date().toISOString() }).eq("id", mine).select("id");
    expect(update.data ?? []).toEqual([]);
    await a.client.from("surveys").delete().eq("id", mine);
    const { data } = await service.from("surveys").select("archived_at").eq("id", mine).single().throwOnError();
    expect(data.archived_at).toBeNull();
  });

  // multi-user#R-8 — 정지 칸은 서버만 바꾼다
  it("프로필은 자기 것만 읽고, 직접 고치지 못한다", async () => {
    expect((await a.client.from("profiles").select("id")).data).toEqual([{ id: a.id }]);
    await service.from("profiles").update({ suspended_at: new Date().toISOString(), suspend_reason: "테스트" }).eq("id", a.id).throwOnError();
    await a.client.from("profiles").update({ suspended_at: null, suspend_reason: null }).eq("id", a.id);
    const { data } = await service.from("profiles").select("suspended_at").eq("id", a.id).single().throwOnError();
    expect(data.suspended_at).not.toBeNull();
    await service.from("profiles").update({ suspended_at: null, suspend_reason: null }).eq("id", a.id).throwOnError();
  });

  // multi-user#R-7 — 탈퇴(Auth 사용자 삭제)하면 설문과 아래 행이 지워지고, 사용 기록은 사용자 칸만 빈다
  it("Auth 사용자를 지우면 프로필·설문·하위 행이 지워지고 usage_events.user_id는 null", async () => {
    const leaving = await users.signIn("mu-leave");
    const sid = await surveyOf(leaving.id);
    const { data: usage } = await service
      .from("usage_events")
      .insert({ kind: "ai", purpose: "test", status: "ok", user_id: leaving.id, survey_id: sid })
      .select("id")
      .single()
      .throwOnError();
    const { error: deleteError } = await service.auth.admin.deleteUser(leaving.id);
    expect(deleteError).toBeNull();
    expect((await service.from("profiles").select("id").eq("id", leaving.id)).data).toEqual([]);
    expect((await service.from("surveys").select("id").eq("id", sid)).data).toEqual([]);
    expect((await service.from("questions").select("id").eq("survey_id", sid)).data).toEqual([]);
    const { data: kept } = await service.from("usage_events").select("user_id, survey_id").eq("id", usage.id).single().throwOnError();
    expect(kept).toEqual({ user_id: null, survey_id: null });
    await service.from("usage_events").delete().eq("id", usage.id);
  });

  // multi-user#R-14 — 내림 표시는 칸 두 개가 함께
  it("taken_down_at과 사유는 함께 있거나 함께 없다", async () => {
    const sid = await surveyOf(a.id);
    const half = await service.from("surveys").update({ taken_down_at: new Date().toISOString() }).eq("id", sid);
    expect(half.error).not.toBeNull();
    const both = await service.from("surveys").update({ taken_down_at: new Date().toISOString(), takedown_reason: "스팸" }).eq("id", sid);
    expect(both.error).toBeNull();
  });
});
