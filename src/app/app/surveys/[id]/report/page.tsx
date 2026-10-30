import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { ownedSurvey } from "@/lib/members";
import { latestReport, VERDICT_LABEL } from "@/lib/report";
import { buildReportView, type ReportGroup } from "@/lib/report-view";
import { loadResults, type QuestionStat } from "@/lib/results";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintButton } from "./print-button";

// 결과 보고서(survey-pilot R-33): 설문이 끝난 뒤 한눈에 평가하는 한 장.
// 요약 숫자 → 문제에 대한 답 → 핵심 문제 → 가설별 문항 그래프 → 주관식 주제 표 → 다음 행동. 인쇄·PDF로도 저장한다.
// 차트(dataviz): 한 계열이라 한 색, 가장 많이 고른 답은 색이 아니라 굵은 글자와 "최다"로 짚는다. 값은 모두 글자로도 보인다.

const kstDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
const VERDICT_TONE = { supported: "bg-accent text-on-accent", rejected: "bg-danger text-white", unclear: "bg-line text-fg" } as const;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-box bg-surface p-5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-3xl font-bold tracking-[-0.02em] tabular-nums">{value}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}

function BarRow({ label, count, ratio, top }: { label: string; count: number; ratio: number; top?: boolean }) {
  return (
    <li className="grid grid-cols-[minmax(0,10rem)_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_5.5rem]">
      <span className={`truncate ${top ? "font-semibold" : ""}`} title={label}>
        {label}
        {top && <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 text-xs font-medium text-accent">최다</span>}
      </span>
      <div className="h-3 rounded-r bg-line" title={`${label}: ${count}명(${percent(ratio)})`}>
        <div className="h-full rounded-r bg-chart" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1 : 0)}%` }} />
      </div>
      <span className={`text-right tabular-nums ${top ? "font-semibold" : "text-muted"}`}>
        {count}명 · {percent(ratio)}
      </span>
    </li>
  );
}

function QuestionChart({ stat, top }: { stat: QuestionStat; top?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-box bg-bg p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-medium">
          {stat.question.position}. {stat.question.prompt}
        </h4>
        <span className="shrink-0 text-xs text-muted">답 {stat.answered}명</span>
      </div>
      {stat.kind === "choice" && (
        <ul className="flex flex-col gap-2">
          {stat.options.map((o) => (
            <BarRow key={o.id} label={o.label} count={o.count} ratio={o.ratio} top={o.id === top} />
          ))}
        </ul>
      )}
      {stat.kind === "scale" && (
        <>
          <p className="text-sm">
            평균 <strong className="text-lg tabular-nums">{stat.mean ?? "—"}</strong> <span className="text-muted">/ 5</span>
          </p>
          <ul className="flex flex-col gap-2">
            {stat.distribution.map((count, i) => (
              <BarRow key={i} label={`${i + 1}점`} count={count} ratio={stat.answered ? count / stat.answered : 0} />
            ))}
          </ul>
        </>
      )}
      {stat.kind === "text" && <p className="text-sm text-muted">주관식 답 {stat.answered}개 — 아래 &ldquo;주관식에서 나온 이야기&rdquo;에 묶었어요.</p>}
    </div>
  );
}

function Group({ group }: { group: ReportGroup }) {
  const h = group.hypothesis;
  return (
    <section className="flex flex-col gap-4 rounded-box bg-surface p-5 break-inside-avoid">
      {h ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted">가설 {h.index}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${VERDICT_TONE[h.verdict]}`}>{VERDICT_LABEL[h.verdict]}</span>
          </div>
          <h3 className="text-lg font-semibold">{h.statement}</h3>
          {h.evidence && <p className="text-sm leading-6 text-muted">{h.evidence}</p>}
        </div>
      ) : (
        <h3 className="text-lg font-semibold">가설과 묶이지 않은 문항</h3>
      )}
      {group.stats.length === 0 ? (
        <p className="text-sm text-muted">이 가설과 묶인 문항이 없어요.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {group.stats.map((s) => (
            <QuestionChart key={s.question.id} stat={s} top={group.top[s.question.id]} />
          ))}
        </div>
      )}
    </section>
  );
}

async function Report({ params }: PageProps<"/app/surveys/[id]/report">) {
  const { db, user } = await requireMember();
  const { id } = await params;
  const survey = await ownedSurvey<{ id: string; problem: string; status: string; target_responses: number | null; closed_at: string | null }>(
    db,
    user.id,
    id,
    "id, problem, status, target_responses, closed_at",
  );
  if (!survey) notFound();
  const service = createAdminClient();
  const [results, report, { data: hypotheses }, { data: links }] = await Promise.all([
    loadResults(db, id),
    latestReport(service, id),
    service.from("hypotheses").select("id, position, statement").eq("survey_id", id).throwOnError(),
    service.from("questions").select("id, hypothesis_id").eq("survey_id", id).throwOnError(),
  ]);

  if (!report?.content.key_problems) {
    return (
      <div className="flex flex-col gap-4 rounded-box bg-surface p-6">
        <h1 className="text-2xl font-bold">{survey.problem}</h1>
        <p className="text-muted">결과 보고서는 리포트를 만든 뒤에 볼 수 있어요. 설문 화면에서 리포트를 만들어 주세요.</p>
        <Link href={`/app/surveys/${id}`} className="inline-flex min-h-11 items-center self-start rounded-box bg-accent px-5 font-medium text-on-accent">
          설문 화면으로
        </Link>
      </div>
    );
  }

  const view = buildReportView({
    hypotheses: hypotheses ?? [],
    links: Object.fromEntries((links ?? []).map((l) => [l.id, l.hypothesis_id])),
    stats: results.stats,
    report: report.content,
    target: survey.target_responses,
    submittedAt: results.responses.map((r) => r.submitted_at),
    closedAt: survey.closed_at,
  });
  const { summary } = view;
  const period = summary.from && summary.to ? `${kstDate.format(new Date(summary.from))} ~ ${kstDate.format(new Date(summary.to))}` : "—";
  const stale = report.response_count !== results.responseCount;

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-accent">
          결과 보고서 · {report.kind === "final" ? "최종" : "중간"}
          {report.is_tentative && " (목표 응답 수 전 — 잠정)"}
        </p>
        <h1 className="text-3xl leading-tight font-bold">{survey.problem}</h1>
        {stale && (
          <p role="status" className="rounded-box bg-note-bg p-3 text-sm text-note-fg">
            리포트를 만든 뒤 응답이 바뀌었어요(리포트 {report.response_count}명, 지금 {results.responseCount}명). 숫자 그래프는 지금 기준이에요.
          </p>
        )}
      </header>

      <section aria-label="요약 숫자" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="응답" value={`${summary.responses}명`} sub={summary.target ? `목표 ${summary.target}명` : undefined} />
        <Tile label="목표 달성" value={summary.progress === null ? "—" : percent(summary.progress)} />
        <Tile label="조사 기간" value={summary.from ? `${Math.max(1, Math.ceil((Date.parse(summary.to!) - Date.parse(summary.from)) / 86_400_000))}일` : "—"} sub={period} />
        <Tile
          label="가설 판정"
          value={`지지 ${summary.verdicts.supported}`}
          sub={`기각 ${summary.verdicts.rejected} · 판단 불가 ${summary.verdicts.unclear}`}
        />
      </section>

      <section aria-labelledby="answer" className="flex flex-col gap-3">
        <h2 id="answer" className="text-xl font-semibold">
          문제에 대한 답
        </h2>
        <p className="text-lg leading-8">{report.content.answer}</p>
      </section>

      <section aria-labelledby="problems" className="flex flex-col gap-4">
        <h2 id="problems" className="text-xl font-semibold">
          드러난 핵심 문제
        </h2>
        <ol className="grid gap-4 lg:grid-cols-3">
          {report.content.key_problems.map((p, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-box bg-surface p-5 break-inside-avoid">
              <span className="text-sm font-semibold text-accent tabular-nums">{i + 1}</span>
              <span className="text-lg leading-7 font-semibold">{p.title}</span>
              <span className="text-sm leading-6 text-muted">{p.evidence}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="by-hypothesis" className="flex flex-col gap-4">
        <h2 id="by-hypothesis" className="text-xl font-semibold">
          가설별 결과
        </h2>
        {view.groups.map((g, i) => (
          <Group key={g.hypothesis?.index ?? `loose-${i}`} group={g} />
        ))}
      </section>

      {view.themes.length > 0 && (
        <section aria-labelledby="themes" className="flex flex-col gap-4">
          <h2 id="themes" className="text-xl font-semibold">
            주관식에서 나온 이야기
          </h2>
          <div className="overflow-x-auto rounded-box bg-surface p-2">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">주제</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">말한 사람</th>
                  <th className="px-3 py-2 font-medium">대표 문장</th>
                </tr>
              </thead>
              <tbody>
                {view.themes.map((t) => (
                  <tr key={t.title} className="border-t border-line align-top">
                    <td className="px-3 py-3">
                      <span className="font-medium">{t.title}</span>
                      <span className="mt-1 block text-muted">{t.summary}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.mentions ?? t.quotes.length}명</td>
                    <td className="px-3 py-3">&ldquo;{t.quotes[0]}&rdquo;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="next" className="flex flex-col gap-3">
        <h2 id="next" className="text-xl font-semibold">
          다음 행동
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 leading-7">
          {report.content.next_actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </section>
    </article>
  );
}

export default function ResultReportPage(props: PageProps<"/app/surveys/[id]/report">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Suspense>
          <BackLink params={props.params} />
        </Suspense>
        <PrintButton />
      </div>
      <Suspense fallback={<p className="py-16 text-center text-muted">보고서를 정리하는 중…</p>}>
        <Report {...props} />
      </Suspense>
    </main>
  );
}

async function BackLink({ params }: { params: PageProps<"/app/surveys/[id]/report">["params"] }) {
  const { id } = await params;
  return (
    <Link href={`/app/surveys/${id}`} className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
      ← 설문 화면
    </Link>
  );
}
