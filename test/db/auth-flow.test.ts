import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmSignup, passwordProblem, resetWithCode, signInWithPassword } from "../../src/lib/auth-flow";
import { anonKey, hasDb, secretKey, url, type Db } from "./helpers";

// 이메일·비밀번호 로그인과 메일 인증번호(multi-user R-1). 실제 메일은 보내지 않는다 —
// 관리 API(generateLink)가 메일 대신 인증번호를 돌려준다. 계정은 @example.com만.
describe("비밀번호 규칙 (multi-user R-1)", () => {
  // multi-user#R-1
  it("8자 미만·72바이트 초과는 거부", () => {
    expect(passwordProblem("1234567")).toMatch(/8자/);
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("가".repeat(25))).toMatch(/길어요/); // 75바이트 — bcrypt는 72바이트까지만 쓴다
  });
});

describe.skipIf(!hasDb)("이메일·비밀번호 로그인 (실제 DB)", () => {
  let service: Db;
  const ids: string[] = [];
  const anon = () => createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = (name: string) => `test-pw-${name}-${randomUUID().slice(0, 8)}@example.com`;

  beforeAll(() => {
    service = createClient(url!, secretKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  });
  afterAll(async () => {
    for (const id of ids) await service.auth.admin.deleteUser(id);
  });

  // multi-user#R-1
  it("인증번호로 가입을 마치기 전에는 로그인되지 않고, 마치면 로그인되며 profiles 1행", async () => {
    const e = email("signup");
    const { data, error } = await service.auth.admin.generateLink({ type: "signup", email: e, password: "correct-horse" });
    if (error) throw error;
    ids.push(data.user.id);

    expect(await signInWithPassword(anon(), e, "correct-horse")).toMatch(/인증번호/); // 가입 확인 전
    expect(await confirmSignup(anon(), e, "000000")).toMatch(/맞지 않/);
    expect(await confirmSignup(anon(), e, data.properties.email_otp)).toBeNull();

    expect(await signInWithPassword(anon(), e, "wrong-password")).toBe("이메일이나 비밀번호가 맞지 않아요.");
    expect(await signInWithPassword(anon(), e, "correct-horse")).toBeNull();
    expect((await service.from("profiles").select("email").eq("id", data.user.id)).data).toEqual([{ email: e }]);
  });

  // multi-user#R-1
  it("없는 계정도 같은 문구 — 어느 쪽이 틀렸는지 알리지 않는다", async () => {
    expect(await signInWithPassword(anon(), email("nobody"), "whatever-123")).toBe("이메일이나 비밀번호가 맞지 않아요.");
  });

  // multi-user#R-1 — 비밀번호가 없던 계정(이메일 링크 시절 운영자)도 재설정으로 비밀번호를 정한다
  it("재설정 인증번호로 새 비밀번호를 정하면 그것으로 로그인", async () => {
    const e = email("reset");
    const { data: created, error } = await service.auth.admin.createUser({ email: e, email_confirm: true });
    if (error) throw error;
    ids.push(created.user.id);
    const { data: link } = await service.auth.admin.generateLink({ type: "recovery", email: e });

    expect(await resetWithCode(anon(), e, link.properties!.email_otp, "short")).toMatch(/8자/);
    expect(await resetWithCode(anon(), e, "000000", "brand-new-pass")).toMatch(/맞지 않/);
    const { data: again } = await service.auth.admin.generateLink({ type: "recovery", email: e });
    expect(await resetWithCode(anon(), e, again.properties!.email_otp, "brand-new-pass")).toBeNull();
    expect(await signInWithPassword(anon(), e, "brand-new-pass")).toBeNull();
  });
});
