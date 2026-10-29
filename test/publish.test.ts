import { describe, expect, it } from "vitest";
import { buildShareText, makeSlug } from "../src/lib/publish";

describe("공개 링크 slug", () => {
  // survey-pilot#R-14
  it("12자 영문·숫자이고, 1,000번 만들어도 겹치지 않는다(추측하기 어렵다)", () => {
    const slugs = Array.from({ length: 1000 }, () => makeSlug());
    expect(slugs.every((s) => /^[A-Za-z0-9]{12}$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(1000);
  });
});

describe("공유 메시지", () => {
  const link = "https://example.com/s/abcDEF123456";

  // survey-pilot#R-15
  it("메시지 끝에 링크를 붙인다", () => {
    expect(buildShareText("3분짜리 설문이에요.", link, 3)).toBe(`3분짜리 설문이에요.\n${link}`);
  });

  // survey-pilot#R-15
  it("메시지에 소요 시간이 없으면 덧붙인다", () => {
    expect(buildShareText("솔직한 의견 부탁해요!", link, 2)).toBe(`솔직한 의견 부탁해요! (약 2분)\n${link}`);
  });

  // survey-pilot#R-15
  it("관리자가 메시지를 비워도 링크와 시간은 들어간다", () => {
    expect(buildShareText("   ", link, 5)).toBe(`설문에 참여해 주세요. (약 5분)\n${link}`);
  });
});
