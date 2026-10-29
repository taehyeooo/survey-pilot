import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSupabaseUsageStore, MINUTE_MS, type UsageStore } from "../../src/lib/usage";

// 실제 usage_events에 대고 확인한다. 키가 없으면(CI) 건너뛴다. 이 테스트가 남긴 행은 지운다.
// skipIf여도 describe 본문은 실행되므로 클라이언트는 beforeAll에서 만든다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const purpose = `test-${randomUUID().slice(0, 8)}`;

describe.skipIf(!url || !secretKey)("usage_events 저장소", () => {
  let db: SupabaseClient;
  let store: UsageStore;

  beforeAll(() => {
    db = createClient(url!, secretKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    store = createSupabaseUsageStore(db);
  });

  afterAll(async () => {
    await db?.from("usage_events").delete().eq("purpose", purpose);
  });

  // survey-pilot#R-27 — 다른 실제 사용량이 있을 수 있어 전후 차이로 본다.
  it("ok·error는 세고 blocked는 세지 않으며, 창 밖은 세지 않는다", async () => {
    const since = new Date(Date.now() - MINUTE_MS);
    const before = await store.window("ai", since);

    await store.record({ kind: "ai", purpose, status: "ok" });
    await store.record({ kind: "ai", purpose, status: "error" });
    await store.record({ kind: "ai", purpose, status: "blocked" });
    await store.record({ kind: "mail", purpose, status: "ok" });

    const after = await store.window("ai", since);
    expect(after.count - before.count).toBe(2);
    expect(after.oldest).toBeInstanceOf(Date);

    const future = await store.window("ai", new Date(Date.now() + MINUTE_MS));
    expect(future.count).toBe(0);
    expect(future.oldest).toBeNull();
  });
});
