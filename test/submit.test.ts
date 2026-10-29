import { describe, expect, it } from "vitest";
import { validateAnswers, type SubmitQuestion } from "../src/lib/submit";

const questions: SubmitQuestion[] = [
  { id: "q1", type: "single", required: true, options: [{ id: "o1", label: "가" }, { id: "o2", label: "나" }] },
  { id: "q2", type: "multi", required: true, options: [{ id: "o1", label: "가" }, { id: "o2", label: "나" }, { id: "o3", label: "다" }] },
  { id: "q3", type: "scale", required: true, options: [] },
  { id: "q4", type: "text", required: false, options: [] },
];
const ok = { q1: ["o2"], q2: ["o1", "o3"], q3: ["4"], q4: ["  좋아요  "] };

describe("답 검사", () => {
  // survey-pilot#R-19
  it("유형별 값으로 바꾼다: 고르기는 선택지 id 배열, 척도는 숫자, 주관식은 앞뒤 공백 뺀 글", () => {
    expect(validateAnswers(questions, ok)).toEqual([
      { question_id: "q1", value: ["o2"] },
      { question_id: "q2", value: ["o1", "o3"] },
      { question_id: "q3", value: 4 },
      { question_id: "q4", value: "좋아요" },
    ]);
  });

  // survey-pilot#R-19
  it("필수 문항이 비면 거부, 선택 문항은 비면 빼고 저장", () => {
    expect(() => validateAnswers(questions, { ...ok, q2: [] })).toThrow(/2번/);
    expect(validateAnswers(questions, { ...ok, q4: ["   "] }).map((a) => a.question_id)).toEqual(["q1", "q2", "q3"]);
  });

  // survey-pilot#R-19
  it("없는 선택지 id, 하나 고르기에 두 개, 척도 범위 밖은 거부", () => {
    expect(() => validateAnswers(questions, { ...ok, q1: ["o9"] })).toThrow();
    expect(() => validateAnswers(questions, { ...ok, q1: ["o1", "o2"] })).toThrow();
    expect(() => validateAnswers(questions, { ...ok, q3: ["6"] })).toThrow();
    expect(() => validateAnswers(questions, { ...ok, q3: ["2.5"] })).toThrow();
  });

  // survey-pilot#R-19
  it("주관식은 2,000자까지, 같은 선택지를 두 번 보내면 한 번으로", () => {
    expect(() => validateAnswers(questions, { ...ok, q4: ["가".repeat(2001)] })).toThrow(/2,000자/);
    expect(validateAnswers(questions, { ...ok, q2: ["o1", "o1"] })[1].value).toEqual(["o1"]);
  });
});
