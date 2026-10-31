import { describe, expect, it } from "vitest";
import { isAdminEmail } from "../src/lib/admin";
import { groupByTab, summarize, tabOf } from "../src/lib/surveys";

describe("isAdminEmail", () => {
  // survey-pilot#R-1
  it("ADMIN_EMAIL과 같을 때만, 대소문자·앞뒤 공백은 무시", () => {
    expect(isAdminEmail(" TaeTaeg527@Gmail.com ", "taetaeg527@gmail.com")).toBe(true);
    expect(isAdminEmail("someone@gmail.com", "taetaeg527@gmail.com")).toBe(false);
    expect(isAdminEmail("taetaeg527@gmail.com.evil.com", "taetaeg527@gmail.com")).toBe(false);
  });

  // survey-pilot#R-1
  it("ADMIN_EMAIL이 비어 있으면 아무도 관리자가 아니다", () => {
    expect(isAdminEmail("", "")).toBe(false);
    expect(isAdminEmail("a@b.c", undefined)).toBe(false);
  });
});

describe("탭 나누기", () => {
  const s = (status: string, archived = false) => ({ status, archived_at: archived ? "2026-10-29T00:00:00Z" : null });

  // survey-pilot#R-2
  it("설계 중은 designing·reviewing, 진행 중은 published, 마감은 closed, 보관된 것은 상태와 상관없이 보관함", () => {
    expect(tabOf(s("designing"))).toBe("designing");
    expect(tabOf(s("reviewing"))).toBe("designing");
    expect(tabOf(s("published"))).toBe("active");
    expect(tabOf(s("closed"))).toBe("closed");
    expect(tabOf(s("closed", true))).toBe("archived");
    expect(tabOf(s("designing", true))).toBe("archived");
  });

  // survey-pilot#R-2
  it("탭별로 묶고 모든 설문이 정확히 한 탭에 들어간다", () => {
    const rows = [s("designing"), s("published"), s("published"), s("closed", true)];
    const groups = groupByTab(rows);
    expect(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]))).toEqual({
      designing: 1,
      active: 2,
      closed: 0,
      archived: 1,
    });
  });
});

describe("내 설문 요약", () => {
  const row = (status: string, responseCount: number, archived = false) => ({ status, responseCount, archived_at: archived ? "2026-10-31" : null });

  it("응답 받는 중·모인 응답·마감을 보관함은 빼고 센다", () => {
    const rows = [row("published", 5), row("published", 2), row("closed", 10), row("designing", 0), row("closed", 7, true)];
    expect(summarize(rows)).toEqual({ active: 2, responses: 17, closed: 1 });
  });

  it("설문이 없으면 모두 0", () => {
    expect(summarize([])).toEqual({ active: 0, responses: 0, closed: 0 });
  });
});
