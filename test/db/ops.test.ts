import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isOperator, listUsers, usageSummary } from "../../src/lib/operator";
import { hasDb, testUsers, type Db } from "./helpers";

// 운영 페이지가 읽는 것(multi-user R-10, R-11, R-13). 실제 프로젝트라 다른 사용자·사용량이 있을 수 있어
// 전체 수는 같은 순간의 DB 집계와 비교하고, 이 테스트의 행은 직접 확인한다.
describe.skipIf(!hasDb)("운영 페이지 데이터 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let op: { id: string; email: string };
  let member: { id: string; email: string };
  const purpose = `test-ops-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    op = await users.signIn("ops-operator", { admin: true });
    member = await users.signIn("ops-member");
  });
  afterAll(async () => {
    await service?.from("usage_events").delete().eq("purpose", purpose);
    await users?.cleanup();
  });

  // multi-user#R-10
  it("admins 표에 있고 ADMIN_EMAIL과 같을 때만 운영자", async () => {
    expect(await isOperator(service, op.email, op.email)).toBe(true);
    expect(await isOperator(service, member.email, member.email)).toBe(false); // ADMIN_EMAIL이어도 admins에 없으면
    expect(await isOperator(service, op.email, "someone-else@example.com")).toBe(false); // admins에 있어도 ADMIN_EMAIL이 다르면
    expect(await isOperator(service, undefined, op.email)).toBe(false);
  });

  // multi-user#R-11
  it("사용자 목록 수 = profiles 수, 가입일 최신순, 설문 수·24시간 AI 사용·정지 여부", async () => {
    await service.from("surveys").insert([
      { owner_id: member.id, problem: "스터디 출석률이 왜 떨어질까" },
      { owner_id: member.id, problem: "스터디 출석률이 왜 떨어질까" },
    ]).throwOnError();
    await service.from("usage_events").insert([
      { kind: "ai", purpose, status: "ok", user_id: member.id },
      { kind: "ai", purpose, status: "blocked", user_id: member.id }, // 부르지 않은 것은 세지 않는다
    ]).throwOnError();
    // 여러 행을 한 번에 넣으면 빠진 칸이 null이 된다 — 시각을 정한 행은 따로
    await service.from("usage_events").insert({ kind: "ai", purpose, status: "ok", user_id: member.id, created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() }).throwOnError();

    // 다른 테스트 파일이 동시에 계정을 만들고 지운다 — 읽기 직전·직후 profiles 사이에 있으면 같은 것으로 본다
    const profileIds = async () => new Set(((await service.from("profiles").select("id").throwOnError()).data ?? []).map((p) => p.id as string));
    const before = await profileIds();
    const list = await listUsers(service);
    const after = await profileIds();
    const ids = new Set(list.map((u) => u.id));
    expect(ids.size).toBe(list.length);
    for (const id of before) if (after.has(id)) expect(ids.has(id), id).toBe(true);
    for (const id of ids) expect(before.has(id) || after.has(id), id).toBe(true);
    const created = list.map((u) => u.createdAt);
    expect(created).toEqual([...created].sort().reverse());
    expect(list.find((u) => u.id === member.id)).toMatchObject({ email: member.email, surveys: 2, ai24h: 1, suspended: false });
    expect(list.find((u) => u.id === member.id)!.lastSignInAt).not.toBeNull();
  });

  // multi-user#R-13
  it("한도 사용량 = usage_events 최근 24시간 집계, 사용자별 순위", async () => {
    await service.from("usage_events").insert([
      { kind: "mail", purpose, status: "ok", user_id: op.id },
      { kind: "mail", purpose, status: "error", user_id: op.id },
      { kind: "ai", purpose, status: "ok", user_id: op.id },
    ]).throwOnError();
    // 다른 테스트 파일이 동시에 사용 기록을 넣고 지운다 — 집계 직전·직후 값 사이에 있으면 같은 것으로 본다
    const now = Date.now();
    const since = new Date(now - 24 * 3_600_000).toISOString();
    const counts = async () => {
      const count = async (kind: string | null) => {
        let q = service.from("usage_events").select("id", { count: "exact", head: true }).neq("status", "blocked").gte("created_at", since);
        q = kind ? q.eq("kind", kind) : q.is("user_id", null);
        return (await q.throwOnError()).count!;
      };
      return { ai: await count("ai"), mail: await count("mail"), unattributed: await count(null) };
    };
    const before = await counts();
    const summary = await usageSummary(service, now);
    const after = await counts();
    const between = (value: number, a: number, b: number) => expect(value >= Math.min(a, b) && value <= Math.max(a, b), `${value} ∉ [${a}, ${b}]`).toBe(true);
    between(summary.ai.used, before.ai, after.ai);
    between(summary.mail.used, before.mail, after.mail);
    between(summary.unattributed, before.unattributed, after.unattributed);
    expect(summary.ai.limit).toBeGreaterThan(0);
    expect(summary.ranking.find((r) => r.userId === op.id)).toMatchObject({ email: op.email, ai: 1, mail: 2 });
    const totals = summary.ranking.map((r) => r.ai + r.mail);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
  });
});
