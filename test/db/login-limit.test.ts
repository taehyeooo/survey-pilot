import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { allowLoginRequest, LOGIN_IP_LIMIT } from "../../src/lib/login-limit";
import { hasDb, secretKey, url, type Db } from "./helpers";

// 로그인 링크 요청 횟수 제한(multi-user R-1). 실행마다 다른 비밀값이라 해시가 다른 실행과 겹치지 않는다.
describe.skipIf(!hasDb)("로그인 링크 요청 횟수 제한 (실제 DB)", () => {
  const secret = `test-${randomUUID()}`;
  let db: Db;

  beforeAll(() => {
    db = createClient(url!, secretKey!, { auth: { persistSession: false } });
  });

  // multi-user#R-1
  it("같은 IP는 시간당 5회까지, 6번째는 거부", async () => {
    const now = Date.now();
    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      expect(await allowLoginRequest(db, secret, { ip: "10.0.0.1", email: `u${i}@example.com` }, now + i * 61_000)).toBe(true);
    }
    expect(await allowLoginRequest(db, secret, { ip: "10.0.0.1", email: "u9@example.com" }, now + 10 * 61_000)).toBe(false);
    expect(await allowLoginRequest(db, secret, { ip: "10.0.0.2", email: "u9@example.com" }, now + 10 * 61_000)).toBe(true);
  });

  // multi-user#R-1
  it("같은 이메일은 1분에 1회, 대소문자가 달라도 같은 이메일", async () => {
    const now = Date.now();
    expect(await allowLoginRequest(db, secret, { ip: "10.0.1.1", email: "same@example.com" }, now)).toBe(true);
    expect(await allowLoginRequest(db, secret, { ip: "10.0.1.2", email: " Same@Example.com " }, now + 30_000)).toBe(false);
    expect(await allowLoginRequest(db, secret, { ip: "10.0.1.3", email: "same@example.com" }, now + 61_000)).toBe(true);
  });

  // multi-user#R-1 — 원문은 저장하지 않는다(ADR 0017)
  it("IP·이메일 원문이 저장되지 않는다", async () => {
    const email = `raw-${randomUUID()}@example.com`;
    await allowLoginRequest(db, secret, { ip: "10.0.2.1", email }, Date.now());
    const { data } = await db.from("login_attempts").select("ip_hash, email_hash").order("id", { ascending: false }).limit(1).throwOnError();
    expect(JSON.stringify(data)).not.toContain(email);
    expect(JSON.stringify(data)).not.toContain("10.0.2.1");
  });
});
