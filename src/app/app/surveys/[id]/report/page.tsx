import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { ownedSurvey } from "@/lib/members";
import { latestReport, VERDICT_LABEL } from "@/lib/report";
import { buildReportView, type ReportGroup } from "@/lib/report-view";
import { loadResults, type QuestionStat } from "@/lib/results";
import { createAdminClient } from "@/lib/supabase/admin";
import { IconArrowRight, IconCalendar, IconChat, IconCheckCircle, IconList, IconTarget, IconUsers } from "../../../../icons";
import { PrintButton } from "./print-button";

// 결과 보고서(survey-pilot R-33): 설문이 끝난 뒤 한눈에 평가하는 한 장.
// 첫 화면에서 끝나게: 결론 한 줄·응답·기간 → 핵심 문제(큰 숫자) → 가설 판정 | 문항별 대표 결과 → 주관식 주제 | 다음 행동.
// 문항별 전체 그래프는 맨 아래 "자세히"에 접어 둔다. 인쇄·PDF로도 저장한다.
// 차트(dataviz): 한 계열이라 한 색, 가장 많이 고른 답은 색이 아니라 굵은 글자와 "최다"로 짚는다. 값은 모두 글자로도 보인다.

const kstShort = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
// 핵심 문제 카드마다 파스텔 포인트(꾸밈 — 순서는 번호로 읽는다)
const PROBLEM_TINTS = ["bg-tint-1", "bg-tint-3", "bg-tint-2"];
const VERDICT_TONE = { supported: "bg-accent text-on-accent", rejected: "bg-danger text-white", unclear: "bg-line text-fg" } as const;

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
    <div className="flex flex-col gap-3 card p-4">
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
            평균 <strong className="text-lg tabular-nums">{stat.mean?.toFixed(1) ?? "—"}</strong> <span className="text-muted">/ 5</span>
          </p>
          <ul className="flex flex-col gap-2">
            {stat.distribution.map((count, i) => (
              <BarRow key={i} label={`${i + 1}점`} count={count} ratio={stat.answered ? count / stat.answered : 0} />
            ))}
          </ul>
        </>
      )}
      {stat.kind === "text" && <p className="text-sm text-muted">주관식 답 {stat.answered}개 — 위 &ldquo;주관식에서 나온 이야기&rdquo;에 묶었어요.</p>}
    </div>
  );
}

function Group({ group }: { group: ReportGroup }) {
  const h = group.hypothesis;
  return (
    <section className="flex flex-col gap-4 rounded-box bg-bg p-5 break-inside-avoid">
      {h ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted">가설 {h.index}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${VERDICT_TONE[h.verdict]}`}>{VERDICT_LABEL[h.verdict]}</span>
          </div>
          <h3 className="text-lg font-semibold">{h.statement}</h3>
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

  if (!report?.content.headline) {
    return (
      <div className="flex flex-col gap-4 card p-6">
        <h1 className="text-headline">{survey.problem}</h1>
        <p className="text-muted">결과 보고서는 리포트를 만든 뒤에 볼 수 있어요. 전에 만든 리포트라면 설문 화면에서 리포트를 다시 만들어 주세요.</p>
        <Link href={`/app/surveys/${id}`} className="btn btn-primary self-start">
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
  const content = report.content;
  const period = summary.from && summary.to ? `${kstShort.format(new Date(summary.from))} ~ ${kstShort.format(new Date(summary.to))}` : "—";
  const days = summary.from && summary.to ? Math.max(1, Math.ceil((Date.parse(summary.to) - Date.parse(summary.from)) / 86_400_000)) : null;
  const stale = report.response_count !== results.responseCount;
  const maxMentions = Math.max(1, ...view.themes.map((t) => t.mentions ?? t.quotes.length));

  return (
    <article className="flex flex-col gap-6">
      {stale && (
        <p role="status" className="rounded-box bg-note-bg p-3 text-sm text-note-fg">
          리포트를 만든 뒤 응답이 바뀌었어요(리포트 {report.response_count}명, 지금 {results.responseCount}명). 그래프는 지금 기준이에요.
        </p>
      )}

      {/* 1. 결론 — 화면을 열자마자 보이는 한 줄과 숫자 */}
      <section aria-label="결론" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3 card p-7">
          <p className="text-sm font-medium text-muted">
            {survey.problem} · {report.kind === "final" ? "최종" : "중간"} 결과{report.is_tentative ? " (목표 응답 수 전 — 잠정)" : ""}
          </p>
          <h1 className="text-headline">{content.headline}</h1>
          <p className="leading-7 text-muted">{content.answer}</p>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="flex flex-col gap-2 card p-5">
            <dt className="flex items-center gap-1.5 text-sm text-muted">
              <IconUsers className="size-4 text-brand" />
              응답
            </dt>
            <dd className="text-3xl font-bold tracking-display tabular-nums">
              {summary.responses}
              <span className="text-base font-medium text-muted">{summary.target ? ` / ${summary.target}명` : "명"}</span>
            </dd>
            {summary.progress !== null && (
              <dd>
                <div className="h-2 rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.progress * 100)} aria-label="목표 달성">
                  <div className="h-full rounded-full bg-chart" style={{ width: `${Math.min(summary.progress, 1) * 100}%` }} />
                </div>
                <span className="mt-1 block text-sm text-muted">목표의 {percent(summary.progress)}</span>
              </dd>
            )}
          </div>
          <div className="flex flex-col gap-1 card p-5">
            <dt className="flex items-center gap-1.5 text-sm text-muted">
              <IconCalendar className="size-4 text-brand" />
              조사 기간
            </dt>
            <dd className="text-3xl font-bold tracking-display tabular-nums">{days ? `${days}일` : "—"}</dd>
            <dd className="text-sm text-muted">{period}</dd>
          </div>
        </dl>
      </section>

      {/* 2. 핵심 문제 — 큰 숫자 하나씩 */}
      <section aria-labelledby="problems" className="flex flex-col gap-3">
        <h2 id="problems" className="text-eyebrow flex items-center gap-1.5">
          <IconTarget className="size-4 text-brand" />
          드러난 핵심 문제
        </h2>
        <ol className={`grid gap-4 ${content.key_problems.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {content.key_problems.map((p, i) => (
            <li key={i} className={`flex flex-col gap-2 rounded-box p-5 break-inside-avoid ${PROBLEM_TINTS[i % PROBLEM_TINTS.length]}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-accent tabular-nums">{i + 1}</span>
                {p.metric && <span className="text-3xl font-bold tracking-display text-brand tabular-nums">{p.metric}</span>}
              </div>
              <span className="text-lg leading-7 font-semibold">{p.title}</span>
              <span className="text-sm leading-6 text-muted">{p.evidence}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. 한 화면 요약 — 가설 판정 | 문항별 대표 결과 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="verdicts" className="flex flex-col gap-3 card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="verdicts" className="flex items-center gap-2 text-lg font-semibold">
            <IconCheckCircle className="size-5 text-brand" />
            가설 판정
          </h2>
            <span className="text-sm text-muted">
              지지 {summary.verdicts.supported} · 기각 {summary.verdicts.rejected} · 판단 불가 {summary.verdicts.unclear}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {view.groups.flatMap((g) =>
              g.hypothesis
                ? [
                    <li key={g.hypothesis.index} className="flex gap-3 py-3">
                      <span className={`h-fit shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold ${VERDICT_TONE[g.hypothesis.verdict]}`}>
                        {VERDICT_LABEL[g.hypothesis.verdict]}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{g.hypothesis.statement}</span>
                        {g.hypothesis.evidence && <span className="text-sm leading-6 text-muted">{g.hypothesis.evidence}</span>}
                      </span>
                    </li>,
                  ]
                : [],
            )}
          </ul>
        </section>
        <section aria-labelledby="highlights" className="flex flex-col gap-3 card p-5">
          <h2 id="highlights" className="flex items-center gap-2 text-lg font-semibold">
            <IconList className="size-5 text-brand" />
            문항별 대표 결과
          </h2>
          <ul className="flex flex-col gap-3">
            {view.highlights.map((h) => (
              <li key={h.id} className="flex flex-col gap-1.5">
                <span className="truncate text-sm text-muted" title={h.prompt}>
                  {h.position}. {h.prompt}
                </span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="h-2.5 rounded-full bg-line" title={`${h.label} ${h.value}`}>
                    <span className="block h-full rounded-full bg-chart" style={{ width: `${Math.max(h.ratio * 100, 2)}%` }} />
                  </span>
                  <span className="text-sm whitespace-nowrap tabular-nums">
                    <strong className="font-semibold">{h.label}</strong> {h.value}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 4. 주관식 주제 | 다음 행동 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {view.themes.length > 0 && (
          <section aria-labelledby="themes" className="flex flex-col gap-3 card p-5">
            <h2 id="themes" className="flex items-center gap-2 text-lg font-semibold">
            <IconChat className="size-5 text-brand" />
            주관식에서 나온 이야기
          </h2>
            <ul className="flex flex-col gap-4">
              {view.themes.map((t) => {
                const mentions = t.mentions ?? t.quotes.length;
                return (
                  <li key={t.title} className="flex flex-col gap-1.5">
                    <span className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-sm tabular-nums text-muted">{mentions}명</span>
                    </span>
                    <span className="h-2 rounded-full bg-line">
                      <span className="block h-full rounded-full bg-chart" style={{ width: `${(mentions / maxMentions) * 100}%` }} />
                    </span>
                    <span className="text-sm leading-6 text-muted">&ldquo;{t.quotes[0]}&rdquo;</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-labelledby="next" className="flex flex-col gap-3 card p-5">
          <h2 id="next" className="flex items-center gap-2 text-lg font-semibold">
            <IconArrowRight className="size-5 text-brand" />
            다음 행동
          </h2>
          <ol className="flex flex-col gap-3">
            {content.next_actions.map((a, i) => (
              <li key={i} className="flex gap-3 leading-7">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent tabular-nums">
                  {i + 1}
                </span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 5. 자세히 — 가설별 문항 그래프 전체 */}
      <details className="card p-5">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">문항별 전체 결과 자세히 보기</summary>
        <div className="mt-4 flex flex-col gap-4">
          {view.groups.map((g, i) => (
            <Group key={g.hypothesis?.index ?? `loose-${i}`} group={g} />
          ))}
        </div>
      </details>
    </article>
  );
}

export default function ResultReportPage(props: PageProps<"/app/surveys/[id]/report">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
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
