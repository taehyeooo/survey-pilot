import type { Report } from "@/lib/report";
import type { QuestionStat } from "@/lib/results";

// 결과 보고서 화면(survey-pilot R-33)에 보일 것을 한 곳에서 계산한다 — 화면은 그리기만.

type Verdict = Report["hypotheses"][number]["verdict"];

export interface ReportViewInput {
  hypotheses: { id: string; position: number; statement: string }[];
  links: Record<string, string | null>; // 문항 id → 가설 id
  stats: QuestionStat[];
  report: Report;
  target: number | null;
  submittedAt: string[];
  closedAt: string | null;
}

export interface ReportGroup {
  hypothesis: { index: number; statement: string; verdict: Verdict; evidence: string } | null; // null = 가설이 없는 문항
  stats: QuestionStat[];
  top: Record<string, string>; // 문항 id → 가장 많이 고른 선택지 id
}

export function buildReportView(input: ReportViewInput) {
  const verdicts: Record<Verdict, number> = { supported: 0, rejected: 0, unclear: 0 };
  for (const h of input.report.hypotheses) verdicts[h.verdict]++;
  const times = [...input.submittedAt].sort();
  const responses = input.submittedAt.length;

  const hypotheses = [...input.hypotheses].sort((a, b) => a.position - b.position);
  const groupOf = (hypothesisId: string | null) => input.stats.filter((s) => (input.links[s.question.id] ?? null) === hypothesisId);
  // 고르는 문항에서 가장 많이 고른 답(동률이면 앞의 선택지) — 화면이 굵게·"최다" 표시로 짚는다(색만으로 말하지 않게)
  const topOf = (stats: QuestionStat[]) =>
    Object.fromEntries(
      stats.flatMap((s) => (s.kind === "choice" && s.answered > 0 ? [[s.question.id, s.options.reduce((best, o) => (o.count > best.count ? o : best)).id]] : [])),
    );
  const groups: ReportGroup[] = hypotheses.map((h, i) => {
    const judged = input.report.hypotheses.find((r) => r.index === i + 1);
    const stats = groupOf(h.id);
    return { hypothesis: { index: i + 1, statement: h.statement, verdict: judged?.verdict ?? "unclear", evidence: judged?.evidence ?? "" }, stats, top: topOf(stats) };
  });
  const loose = groupOf(null);
  if (loose.length) groups.push({ hypothesis: null, stats: loose, top: topOf(loose) });

  return {
    summary: {
      responses,
      target: input.target,
      progress: input.target ? Math.round((responses / input.target) * 100) / 100 : null,
      from: times[0] ?? null,
      to: input.closedAt ?? times.at(-1) ?? null,
      verdicts,
    },
    groups,
    themes: [...input.report.themes].sort((a, b) => (b.mentions ?? b.quotes.length) - (a.mentions ?? a.quotes.length)),
  };
}
