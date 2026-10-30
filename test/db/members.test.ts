import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agreeToTerms, isSuspended, loadMember, needsAgreement, ownedSurvey } from "../../src/lib/members";
import { hasDb, testUsers, type Db } from "./helpers";

describe("이용 안내 동의 (multi-user R-2)", () => {
  // multi-user#R-2
  it("agreed_at이 없거나 행이 없으면 동의 전", () => {
    expect(needsAgreement(null)).toBe(true);
    expect(needsAgreement({ agreed_at: null })).toBe(true);
    expect(needsAgreement({ agreed_at: "2026-10-30T00:00:00Z" })).toBe(false);
  });
});

describe("정지 (multi-user R-8)", () => {
  // multi-user#R-8
  it("suspended_at이 있으면 정지", () => {
    expect(isSuspended(null)).toBe(false);
    expect(isSuspended({ suspended_at: null })).toBe(false);
    expect(isSuspended({ suspended_at: "2026-10-30T00:00:00Z" })).toBe(true);
  });
});

describe.skipIf(!hasDb)("동의와 주인 확인 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let a: { client: Db; id: string };
  let b: { client: Db; id: string };

  beforeAll(async () => {
    users = testUsers();
    a = await users.signIn("owner-a");
    b = await users.signIn("owner-b");
  });
  afterAll(async () => users?.cleanup());

  // multi-user#R-2
  it("새 사용자는 동의 전, 동의하면 시각이 남고 다시 동의해도 바뀌지 않는다", async () => {
    expect(needsAgreement(await loadMember(a.client, a.id))).toBe(true);
    await agreeToTerms(users.service, a.id, new Date("2026-10-30T01:00:00Z"));
    expect(await loadMember(a.client, a.id)).toEqual({ agreed_at: "2026-10-30T01:00:00+00:00", suspended_at: null });
    await agreeToTerms(users.service, a.id, new Date("2026-10-31T01:00:00Z"));
    expect(await loadMember(a.client, a.id)).toEqual({ agreed_at: "2026-10-30T01:00:00+00:00", suspended_at: null });
  });

  // multi-user#R-2 — 남의 동의 상태는 읽을 수 없다(profiles_self_select)
  it("다른 사용자의 동의 상태는 세션으로 읽히지 않는다", async () => {
    expect(await loadMember(b.client, a.id)).toBeNull();
  });

  // multi-user#R-3
  it("남의 설문은 세션으로도, 서버 클라이언트로도 null", async () => {
    const { data: s } = await users.service.from("surveys").insert({ owner_id: a.id, problem: "스터디 출석률이 왜 떨어질까" }).select("id").single().throwOnError();
    expect(await ownedSurvey(a.client, a.id, s!.id, "id")).toEqual({ id: s!.id });
    expect(await ownedSurvey(users.service, a.id, s!.id, "id")).toEqual({ id: s!.id });
    expect(await ownedSurvey(b.client, b.id, s!.id, "id")).toBeNull();
    expect(await ownedSurvey(users.service, b.id, s!.id, "id")).toBeNull();
  });
});
