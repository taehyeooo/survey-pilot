// 설문 단계 진행 표시(디자인 결정 27 C 단계형). 지금 단계까지 채우고, 방금 끝난 칸은 채워지는 움직임.
export const STAGES = ["문제", "설계", "문항", "응답", "리포트"] as const;

export function stageOf(survey: { status: string; purpose?: string | null }) {
  if (survey.status === "closed") return 4;
  if (survey.status === "published") return 3;
  if (survey.status === "reviewing") return 2;
  return survey.purpose ? 1 : 0;
}

export function StageBar({ current, animate = false, className = "" }: { current: number; animate?: boolean; className?: string }) {
  return (
    <ol aria-label={`지금 단계: ${STAGES[current]} (${current + 1}/${STAGES.length})`} className={`grid grid-cols-5 gap-1 ${className}`}>
      {STAGES.map((label, i) => (
        <li key={label} aria-current={i === current ? "step" : undefined} className="flex flex-col gap-1">
          <span aria-hidden className="h-1 overflow-hidden rounded-full bg-line">
            {i <= current && <span className={`block h-full bg-accent ${animate && i === current ? "animate-stage-fill" : ""}`} />}
          </span>
          <span className={`text-xs ${i === current ? "font-medium" : "text-muted"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}
