import { describe, expect, it } from "vitest";
import { emailHashOf, makeCode, makeToken, readToken, TOKEN_TTL_MS } from "../src/lib/respond";

const secret = "test-secret";

describe("해시·인증번호·토큰", () => {
  // survey-pilot#R-18
  it("이메일 해시는 대소문자·앞뒤 공백을 무시하고, 비밀값이 다르면 달라진다", () => {
    expect(emailHashOf(secret, " A@Example.com ")).toBe(emailHashOf(secret, "a@example.com"));
    expect(emailHashOf("other", "a@example.com")).not.toBe(emailHashOf(secret, "a@example.com"));
  });

  // survey-pilot#R-18
  it("인증번호는 6자리 숫자(앞자리 0 포함)", () => {
    const codes = Array.from({ length: 500 }, makeCode);
    expect(codes.every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(450);
  });

  // survey-pilot#R-18
  it("인증 토큰은 30분 동안만, 위조하면 무효", () => {
    const now = 1_000_000;
    const token = makeToken(secret, "respondent-1", now);
    expect(readToken(secret, token, now + TOKEN_TTL_MS - 1)).toBe("respondent-1");
    expect(readToken(secret, token, now + TOKEN_TTL_MS + 1)).toBeNull();
    expect(readToken("other", token, now)).toBeNull();
    expect(readToken(secret, token.replace("respondent-1", "respondent-2"), now)).toBeNull();
    expect(readToken(secret, "엉터리", now)).toBeNull();
  });
});
