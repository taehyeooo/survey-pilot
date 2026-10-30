import { describe, expect, it } from "vitest";
import { consentNotes } from "../src/lib/consent-copy";

describe("응답자 동의 문구 (multi-user R-4)", () => {
  // multi-user#R-4
  it("응답을 누가 보는지와 삭제 요청 연락처를 알린다", () => {
    const notes = consentNotes("help@example.com").join("\n");
    expect(notes).toContain("응답은 설문을 만든 사람이 봐요. 운영자는 응답 수만 봐요.");
    expect(notes).toContain("응답 삭제 요청: help@example.com");
  });

  // multi-user#R-4
  it("연락처가 없으면 설문을 보낸 사람에게 요청하라고 알린다", () => {
    expect(consentNotes(null).join("\n")).toContain("응답 삭제는 설문을 보낸 사람에게 요청해 주세요.");
  });
});
