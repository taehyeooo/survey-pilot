import type { QuestionStat } from "@/lib/results";

// 진행 현황(R-21)·문항별 집계(R-22). 차트 규칙(dataviz): 한 계열이라 한 색(--chart), 막대 12px·끝 4px 둥글게·
// 기준선 쪽은 각지게, 값은 막대 끝 옆에 글자색으로, 막대마다 hover 설명(title). 표 대신 값이 모두 글자로 보인다.

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

function Bar({ ratio, label }: { ratio: number; label: string }) {
  return (
    <div className="h-3 flex-1 rounded-r bg-line/60" title={label}>
      <div className="h-full rounded-r bg-chart" style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 1 : 0)}%` }} />
    </div>
  );
}

function Row({ label, count, ratio }: { label: string; count: number; ratio: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
      <span className="truncate" title={label}>
        {label}
      </span>
      <Bar ratio={ratio} label={`${label}: ${count}명(${percent(ratio)})`} />
      <span className="w-20 text-right tabular-nums text-muted">
        {count}명 · {percent(ratio)}
      </span>
    </li>
  );
}

function StatCard({ stat, index }: { stat: QuestionStat; index: number }) {
  const title = (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-medium">
        {index + 1}. {stat.question.prompt}
      </h3>
      <span className="shrink-0 text-xs text-muted">답 {stat.answered}명</span>
    </div>
  );
  if (stat.kind === "choice") {
    return (
      <li className="flex flex-col gap-3 rounded-box border border-line p-4">
        {title}
        {stat.question.type === "multi" && <p className="text-xs text-muted">여러 개 고르기 — 답한 사람 기준 비율이라 합이 100%를 넘을 수 있어요.</p>}
        <ul className="flex flex-col gap-2">
          {stat.options.map((o) => (
            <Row key={o.id} label={o.label} count={o.count} ratio={o.ratio} />
          ))}
        </ul>
      </li>
    );
  }
  if (stat.kind === "scale") {
    const max = Math.max(1, stat.answered);
    return (
      <li className="flex flex-col gap-3 rounded-box border border-line p-4">
        {title}
        <p className="text-2xl font-semibold tabular-nums">
          {stat.mean ?? "–"}
          <span className="ml-1 text-sm font-normal text-muted">/ 5 평균</span>
        </p>
        <ul className="flex flex-col gap-2">
          {stat.distribution.map((count, i) => (
            <Row key={i} label={`${i + 1}점`} count={count} ratio={count / max} />
          ))}
        </ul>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 rounded-box border border-line p-4">
      {title}
      {stat.texts.length === 0 ? (
        <p className="text-sm text-muted">아직 답이 없어요.</p>
      ) : (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">답 {stat.texts.length}개 보기</summary>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {stat.texts.map((t, i) => (
              <li key={i} className="rounded-box bg-surface px-3 py-2 whitespace-pre-wrap">
                {t}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function remaining(closesAt: string | null, now: number) {
  if (!closesAt) return null;
  const ms = Date.parse(closesAt) - now;
  if (ms <= 0) return "마감 시각이 지났어요";
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? `마감까지 ${Math.floor(hours / 24)}일 ${hours % 24}시간` : `마감까지 ${Math.max(hours, 0)}시간 ${Math.floor((ms % 3_600_000) / 60_000)}분`;
}

export function ResultsSection({
  surveyId,
  stats,
  responseCount,
  target,
  closesAt,
  live,
}: {
  surveyId: string;
  stats: QuestionStat[];
  responseCount: number;
  target: number | null;
  closesAt: string | null;
  live: boolean;
}) {
  // eslint-disable-next-line react-hooks/purity -- 요청마다 렌더하는 서버 컴포넌트(requireMember이 connection()으로 미리 렌더링을 멈춤)
  const left = live ? remaining(closesAt, Date.now()) : null;
  const ratio = target ? Math.min(responseCount / target, 1) : 0;
  return (
    <section aria-labelledby="results-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="results-title" className="text-lg font-semibold">
          결과
        </h2>
        {responseCount > 0 && (
          <a href={`/app/surveys/${surveyId}/export`} className="inline-flex min-h-11 items-center rounded-box px-3 text-sm text-muted underline hover:bg-surface">
            CSV 내려받기
          </a>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-box border border-line p-4">
        <p className="text-sm text-muted">응답</p>
        <p className="text-3xl font-semibold tabular-nums">
          {responseCount}
          {target ? <span className="text-base font-normal text-muted"> / {target}명</span> : <span className="text-base font-normal text-muted">명</span>}
        </p>
        {target ? (
          <div role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={responseCount} aria-label="목표 응답 수 대비" className="h-2 rounded-full bg-line/60">
            <div className="h-full rounded-full bg-chart" style={{ width: `${ratio * 100}%` }} />
          </div>
        ) : null}
        {left && <p className="text-sm text-muted">{left}</p>}
      </div>
      {responseCount === 0 ? (
        <p className="text-sm text-muted">아직 응답이 없어요. 링크를 공유해 보세요.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {stats.map((s, i) => (
            <StatCard key={s.question.id} stat={s} index={i} />
          ))}
        </ol>
      )}
    </section>
  );
}
