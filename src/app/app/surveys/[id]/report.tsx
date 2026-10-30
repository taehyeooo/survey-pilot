import Link from "next/link";
import { VERDICT_LABEL, type ReportRow } from "@/lib/report";
import { AI_STEPS } from "../../ai-steps";
import { SubmitButton } from "../../submit-button";
import { makeReport } from "../actions";

// 문제 답변 리포트(R-24)·주관식 주제(R-23). 판정은 색만이 아니라 글자(지지·기각·판단 불가)로 보인다.
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
        <h2 id="report-title" className="text-lg font-semibold">
          문제에 대한 답
        </h2>
        {report && (
          // 한눈에 평가하는 결과 보고서(R-33) — 요약 숫자·핵심 문제·가설별 그래프·주제 표
          <Link href={`/app/surveys/${surveyId}/report`} className="inline-flex min-h-11 items-center rounded-box bg-accent px-4 text-sm font-medium text-on-accent">
            결과 보고서 보기
          </Link>
        )}
      </div>
      {!report ? (
        <div className="flex flex-col gap-3 rounded-box bg-surface p-4">
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
        <article className="flex flex-col gap-5 rounded-box bg-surface p-5">
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
          <p className="text-lg leading-8 font-medium">{report.content.answer}</p>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted">가설 판정</h3>
            <ul className="flex flex-col gap-2">
              {report.content.hypotheses.map((h) => (
                <li key={h.index} className={`rounded-box border-l-4 bg-bg p-3 ${VERDICT_STYLE[h.verdict]}`}>
                  <p className="text-sm">
                    <span className="font-semibold">{VERDICT_LABEL[h.verdict]}</span> · {hypotheses[h.index - 1] ?? `가설 ${h.index}`}
                  </p>
                  <p className="mt-1 text-sm text-muted">{h.evidence}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted">다음 행동</h3>
            <ol className="list-decimal pl-5 text-sm leading-7">
              {report.content.next_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          </div>
          {report.content.themes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted">주관식에서 나온 이야기</h3>
              <ul className="flex flex-col gap-3">
                {report.content.themes.map((t, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-sm text-muted">{t.summary}</p>
                    {t.quotes.map((q, j) => (
                      <blockquote key={j} className="border-l-2 border-line pl-3 text-sm">
                        “{q}”
                      </blockquote>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">AI가 만든 해석이에요. 수치는 아래 결과에서 확인하세요.</p>
          {(stale || (closed && report.kind !== "final")) && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-sm text-muted">{closed && report.kind !== "final" ? "마감됐어요. 최종 리포트를 만들 수 있어요." : `그 뒤로 응답이 ${responseCount - report.response_count}개 늘었어요.`}</p>
              {button}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
