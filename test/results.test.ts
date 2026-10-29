import { describe, expect, it } from "vitest";
import { aggregate, toCsv, type ResultAnswer, type ResultQuestion } from "../src/lib/results";

const questions: ResultQuestion[] = [
  { id: "q1", position: 1, type: "single", prompt: "어느 주말?", options: [{ id: "o1", label: "첫째 주" }, { id: "o2", label: "둘째 주" }] },
  { id: "q2", position: 2, type: "multi", prompt: "가고 싶은 곳", options: [{ id: "o1", label: "가평" }, { id: "o2", label: "강릉" }, { id: "o3", label: "대부도" }] },
  { id: "q3", position: 3, type: "scale", prompt: "1박이 괜찮나요?", options: [] },
  { id: "q4", position: 4, type: "text", prompt: "더 하고 싶은 말", options: [] },
];
const answers: ResultAnswer[] = [
  { response_id: "r1", question_id: "q1", value: ["o1"] },
  { response_id: "r2", question_id: "q1", value: ["o1"] },
  { response_id: "r3", question_id: "q1", value: ["o2"] },
  { response_id: "r1", question_id: "q2", value: ["o1", "o2"] },
  { response_id: "r2", question_id: "q2", value: ["o2"] },
  { response_id: "r3", question_id: "q2", value: ["o2", "o3"] },
  { response_id: "r1", question_id: "q3", value: 4 },
  { response_id: "r2", question_id: "q3", value: 5 },
  { response_id: "r3", question_id: "q3", value: 2 },
  { response_id: "r2", question_id: "q4", value: "재밌겠어요" },
];

describe("문항별 집계", () => {
  const [single, multi, scale, text] = aggregate(questions, answers);

  // survey-pilot#R-22
  it("하나 고르기는 선택지별 수와 비율, 합계가 답한 사람 수와 같다", () => {
    expect(single).toMatchObject({ answered: 3, options: [{ label: "첫째 주", count: 2 }, { label: "둘째 주", count: 1 }] });
    expect(single.kind === "choice" && single.options.reduce((s, o) => s + o.count, 0)).toBe(3);
    expect(single.kind === "choice" && single.options[0].ratio).toBeCloseTo(2 / 3);
  });

  // survey-pilot#R-22
  it("여러 개 고르기 비율은 답한 사람 수 기준(합이 100%를 넘을 수 있다)", () => {
    expect(multi).toMatchObject({ answered: 3, options: [{ count: 1 }, { count: 3 }, { count: 1 }] });
    expect(multi.kind === "choice" && multi.options[1].ratio).toBe(1);
  });

  // survey-pilot#R-22
  it("척도는 평균(소수 한 자리)과 1~5 분포", () => {
    expect(scale).toMatchObject({ kind: "scale", answered: 3, mean: 3.7, distribution: [0, 1, 0, 1, 1] });
  });

  // survey-pilot#R-22
  it("주관식은 답한 수와 글 목록, 답이 없는 선택 문항은 0", () => {
    expect(text).toMatchObject({ kind: "text", answered: 1, texts: ["재밌겠어요"] });
    const [empty] = aggregate([questions[3]], []);
    expect(empty).toMatchObject({ answered: 0, texts: [] });
  });
});

describe("CSV", () => {
  const responses = [
    { id: "r2", submitted_at: "2026-10-29T01:00:00Z" },
    { id: "r1", submitted_at: "2026-10-29T00:00:00Z" },
    { id: "r3", submitted_at: "2026-10-29T02:00:00Z" },
  ];

  // survey-pilot#R-25
  it("UTF-8 BOM, 머리줄은 응답 시각 + 문항, 응답 1건 = 1줄(시간순), 이메일 열 없음", () => {
    const csv = toCsv(questions, responses, answers);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(1 + responses.length);
    expect(lines[0]).toBe("응답 시각(KST),어느 주말?,가고 싶은 곳,1박이 괜찮나요?,더 하고 싶은 말");
    expect(lines[1]).toBe("2026-10-29 09:00,첫째 주,가평 / 강릉,4,");
    expect(lines[2]).toBe("2026-10-29 10:00,첫째 주,강릉,5,재밌겠어요");
    expect(csv).not.toMatch(/@|이메일/);
  });

  // survey-pilot#R-25
  it("쉼표·따옴표·줄바꿈은 감싸고, =·+·-·@로 시작하는 칸은 수식으로 실행되지 않게 막는다", () => {
    const tricky: ResultAnswer[] = [{ response_id: "r1", question_id: "q4", value: '=HYPERLINK("x"), "a"\n줄' }];
    const csv = toCsv([questions[3]], [responses[1]], tricky);
    expect(csv).toContain(`"'=HYPERLINK(""x""), ""a""\n줄"`);
  });
});
