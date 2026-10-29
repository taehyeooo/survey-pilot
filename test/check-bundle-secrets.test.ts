import { describe, expect, it } from "vitest";
import { findLeaks, secretNames } from "../scripts/check_bundle_secrets.mjs";

// survey-pilot#R-31 — 클라이언트 번들에 비밀값이 들어가면 검사가 실패해야 한다.
describe("check_bundle_secrets", () => {
  it("NEXT_PUBLIC_이 아닌 이름만 비밀값으로 본다", () => {
    const example = "# 주석\nNEXT_PUBLIC_SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\r\nGEMINI_API_KEY=\n\n";
    expect(secretNames(example)).toEqual(["SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"]);
  });

  it("비밀값이 번들에 그대로 있으면 잡는다", () => {
    const leaks = findLeaks(
      [{ path: "a.js", text: 'const k="my-secret-value-123"' }],
      [{ name: "GEMINI_API_KEY", value: "my-secret-value-123" }],
    );
    expect(leaks).toEqual(["a.js: GEMINI_API_KEY 값"]);
  });

  it("값을 몰라도 Supabase 비밀 키 모양이면 잡는다", () => {
    const leaks = findLeaks([{ path: "b.js", text: 'x="sb_secret_abcDEF123"' }], []);
    expect(leaks).toEqual(["b.js: Supabase 비밀 키 모양"]);
  });

  it("비밀값이 없으면 통과한다", () => {
    const leaks = findLeaks(
      [{ path: "c.js", text: 'const url="https://x.supabase.co"; const k="sb_publishable_abc"' }],
      [{ name: "SUPABASE_SERVICE_ROLE_KEY", value: "sb_secret_real" }, { name: "GEMINI_API_KEY", value: undefined }],
    );
    expect(leaks).toEqual([]);
  });
});
