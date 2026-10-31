import { describe, expect, it } from "vitest";
import type { Report } from "../src/lib/report";
import { buildReportView } from "../src/lib/report-view";
import type { QuestionStat } from "../src/lib/results";

// 결과 보고서 화면에 보일 것(survey-pilot R-33): 요약 숫자, 가설별 문항 묶음(가장 많이 고른 답), 주관식 주제 순서.
const q = (id: string, position: number, type: "single" | "scale" | "text", prompt: string) => ({ id, position, type, prompt, options: [] });
const stats: QuestionStat[] = [
  {
    kind: "choice",
    question: q("q1", 1, "single", "주로 어떻게 내나요?"),
    answered: 6,
    options: [
      { id: "o1", label: "계좌이체", count: 3, ratio: 0.5 },
      { id: "o2", label: "현금", count: 1, ratio: 1 / 6 },
      { id: "o3", label: "간편결제", count: 2, ratio: 2 / 6 },
    ],
    others: [],
  },
  { kind: "scale", question: q("q2", 2, "scale", "번거롭나요?"), answered: 6, mean: 3.8, distribution: [0, 1, 1, 2, 2] },
  { kind: "text", question: q("q3", 3, "text", "더 하고 싶은 말"), answered: 2, texts: ["a", "b"] },
];
const report: Report = {
  hypotheses: [
    { index: 1, verdict: "supported", evidence: "번거롭다 평균 3.8" },
    { index: 2, verdict: "unclear", evidence: "관련 문항 없음" },
  ],
  answer: "답",
  next_actions: ["하나", "둘"],
  headline: "번거로워서 늦게 낸다",
  key_problems: [{ title: "납부가 번거롭다", evidence: "평균 3.8/5", metric: "3.8/5" }],
  themes: [
    { title: "적게 나온 것", summary: "s", quotes: ["a"], mentions: 1 },
    { title: "많이 나온 것", summary: "s", quotes: ["b"], mentions: 2 },
  ],
};
const base = {
  hypotheses: [
    { id: "h1", position: 1, statement: "납부 방법이 번거롭다" },
    { id: "h2", position: 2, statement: "금액이 부담된다" },
  ],
  links: { q1: "h1", q2: "h1", q3: null } as Record<string, string | null>,
  stats,
  report,
};

describe("결과 보고서 화면 데이터 (survey-pilot R-33)", () => {
  // survey-pilot#R-33
  it("요약 숫자: 응답 수·목표·달성률·조사 기간·판정 수", () => {
    const view = buildReportView({
      ...base,
      target: 20,
      submittedAt: ["2026-10-30T03:00:00Z", "2026-10-31T09:00:00Z", "2026-10-30T12:00:00Z"],
      closedAt: null,
    });
    expect(view.summary).toEqual({
      responses: 3,
      target: 20,
      progress: 0.15,
      from: "2026-10-30T03:00:00Z",
      to: "2026-10-31T09:00:00Z",
      verdicts: { supported: 1, rejected: 0, unclear: 1 },
    });
    expect(buildReportView({ ...base, target: null, submittedAt: [], closedAt: "2026-11-01T00:00:00Z" }).summary).toMatchObject({ progress: null, from: null, to: "2026-11-01T00:00:00Z" });
  });

  // survey-pilot#R-33
  it("문항은 가설별로 묶고, 가설이 없는 문항은 따로, 고르는 문항은 가장 많이 고른 답을 짚는다", () => {
    const view = buildReportView({ ...base, target: 20, submittedAt: [], closedAt: null });
    expect(view.groups.map((g) => [g.hypothesis?.statement ?? null, g.hypothesis?.verdict ?? null, g.stats.map((s) => s.question.id)])).toEqual([
      ["납부 방법이 번거롭다", "supported", ["q1", "q2"]],
      ["금액이 부담된다", "unclear", []],
      [null, null, ["q3"]],
    ]);
    expect(view.groups[0].top).toEqual({ q1: "o1" });
    // 동률이면 앞의 선택지(화면 순서 그대로)
    const tied = stats.map((s) => (s.kind === "choice" ? { ...s, options: s.options.map((o) => ({ ...o, count: 2 })) } : s));
    expect(buildReportView({ ...base, stats: tied, target: null, submittedAt: [], closedAt: null }).groups[0].top).toEqual({ q1: "o1" });
  });

  // survey-pilot#R-33
  it("주관식 주제는 많이 나온 순서", () => {
    const view = buildReportView({ ...base, target: null, submittedAt: [], closedAt: null });
    expect(view.themes.map((t) => t.title)).toEqual(["많이 나온 것", "적게 나온 것"]);
  });

  // survey-pilot#R-33 — 한 화면 요약: 문항마다 대표 결과 한 줄(주관식은 표에서 따로)
  it("고르는 문항은 최다 답과 비율, 척도는 평균(5점 만점 비율), 주관식은 뺀다", () => {
    const view = buildReportView({ ...base, target: null, submittedAt: [], closedAt: null });
    expect(view.highlights).toEqual([
      { id: "q1", position: 1, prompt: "주로 어떻게 내나요?", label: "계좌이체", value: "50%", ratio: 0.5 },
      { id: "q2", position: 2, prompt: "번거롭나요?", label: "평균", value: "3.8 / 5", ratio: 0.76 },
    ]);
  });
});
