import Link from "next/link";
import { VERDICT_LABEL, type ReportRow } from "@/lib/report";
import { AI_STEPS } from "../../ai-steps";
import { SubmitButton } from "../../submit-button";
import { makeReport } from "../actions";
import { IconBadge, IconTarget } from "../../../icons";

// 문제 답변 리포트(R-24)·주관식 주제(R-23). 판정은 색만이 아니라 글자(그렇다·아니다·판단 보류, 결정 38)로 보인다.
const VERDICT_STYLE = { supported: "border-accent", rejected: "border-danger", unclear: "border-line" } as const;
const kstFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

export function ReportSection({
  surveyId,
  report,
  hypotheses,
  responseCount,
  target,
  closed,
}: {
  surveyId: string;
  report: ReportRow | null;
  hypotheses: string[];
  responseCount: number;
  target: number | null;
  closed: boolean;
}) {
  const stale = report && report.response_count !== responseCount;
  const button = (
    <form action={makeReport.bind(null, surveyId)}>
      <SubmitButton variant={report ? "secondary" : "primary"} pendingSteps={AI_STEPS.report}>
        {closed ? (report?.kind === "final" ? "리포트 다시 보기" : "최종 리포트 만들기") : report ? "중간 리포트 새로 만들기" : "중간 리포트 만들기"}
      </SubmitButton>
    </form>
  );

  return (
    <section aria-labelledby="report-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="report-title" className="flex items-center gap-3 text-title">
          <IconBadge>
            <IconTarget className="size-5" />
          </IconBadge>
          문제에 대한 답
        </h2>
        {report?.content.headline && (
          // 한눈에 평가하는 결과 보고서(R-33) — 결론·핵심 문제·가설 판정·문항별 대표 결과
          <Link href={`/app/surveys/${surveyId}/report`} className="btn btn-primary text-sm">
            결과 보고서 보기
          </Link>
        )}
      </div>
      {!report ? (
        <div className="flex flex-col gap-3 card p-4">
          <p className="text-sm text-muted">
            {responseCount === 0
              ? "응답이 들어오면 AI가 가설마다 판정하고 문제에 대한 답을 정리해요."
              : closed
                ? "최종 리포트가 아직 없어요. 만들어 보세요."
                : "지금까지의 응답으로 중간 리포트를 만들 수 있어요. 마감되면 최종 리포트를 자동으로 만들어요."}
          </p>
          {responseCount > 0 && button}
        </div>
      ) : (
        // 설문 화면에서는 결론과 판정 수만 — 자세한 것은 결과 보고서(R-33)에서 한 장으로 본다
        <article className="flex flex-col gap-4 card p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-bg px-2 py-1 font-medium text-fg">{report.kind === "final" ? "최종" : "중간"}</span>
            {report.is_tentative && (
              <span className="rounded-full bg-note-bg px-2 py-1 font-medium text-note-fg">
                참고용 — 응답 {report.response_count}명{target ? ` / 목표 ${target}명` : ""}
              </span>
            )}
            <span>
              응답 {report.response_count}명 기준 · {kstFormat.format(new Date(report.created_at))}
            </span>
          </div>
          <p className="text-xl leading-8 font-semibold">{report.content.headline ?? report.content.answer}</p>
          {report.content.headline && <p className="leading-7 text-muted">{report.content.answer}</p>}
          <ul className="flex flex-wrap gap-2 text-sm" aria-label="가설 판정">
            {report.content.hypotheses.map((h) => (
              <li key={h.index} className={`rounded-box border-l-4 bg-bg px-3 py-2 ${VERDICT_STYLE[h.verdict]}`}>
                <span className="font-semibold">{VERDICT_LABEL[h.verdict]}</span> · {hypotheses[h.index - 1] ?? `가설 ${h.index}`}
              </li>
            ))}
          </ul>
          {!report.content.headline && <p className="text-sm text-muted">결과 보고서는 리포트를 새로 만들면 볼 수 있어요.</p>}
          <p className="text-xs text-muted">AI가 만든 해석이에요. 수치는 결과에서 확인하세요.</p>
          {(stale || (closed && report.kind !== "final") || !report.content.headline) && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-sm text-muted">
                {closed && report.kind !== "final"
                  ? "마감됐어요. 최종 리포트를 만들 수 있어요."
                  : stale
                    ? `그 뒤로 응답이 ${responseCount - report.response_count}개 늘었어요.`
                    : "새 형식(한 줄 결론·핵심 문제)으로 다시 만들 수 있어요."}
              </p>
              {button}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
