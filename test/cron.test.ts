import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "../src/lib/cron";

describe("크론 인증", () => {
  // survey-pilot#R-30
  it("Bearer 비밀값이 맞을 때만 실행한다, 비밀값이 비어 있으면 아무도 못 부른다", () => {
    expect(isCronAuthorized("Bearer s3cret-value", "s3cret-value")).toBe(true);
    expect(isCronAuthorized("Bearer wrong", "s3cret-value")).toBe(false);
    expect(isCronAuthorized(null, "s3cret-value")).toBe(false);
    expect(isCronAuthorized("s3cret-value", "s3cret-value")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
  });
});
