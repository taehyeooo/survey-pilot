// 첫 화면의 결과 보고서 미리보기(결정 34) — 애플의 제품 사진 자리. 이미지가 아니라 화면 부품으로 그린 예시라 선명하고 가볍다.
// 실제 데이터가 아닌 예시라는 것을 화면 읽기 프로그램에도 알린다. 차트 규칙(dataviz): 한 계열 한 색, 값은 글자로도.
const BARS = [
  { label: "계좌번호를 매번 찾아야 해서", ratio: 0.75 },
  { label: "납부일을 잊어서", ratio: 0.5 },
  { label: "금액이 부담돼서", ratio: 0.13 },
];

export function HeroPreview() {
  return (
    <figure aria-label="결과 보고서 예시" className="card w-full max-w-4xl overflow-hidden text-left shadow-xl">
      <div aria-hidden className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="ml-3 text-xs text-muted">결과 보고서 · 예시</span>
      </div>
      <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <p className="text-eyebrow">동아리 회비를 왜 늦게 낼까 · 응답 24명</p>
          <p className="text-2xl leading-snug font-bold tracking-title sm:text-3xl">
            회비가 늦는 건 <span className="text-brand">번거로운 납부 절차</span> 때문이에요
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {BARS.map((b) => (
              <li key={b.label} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate text-muted">{b.label}</span>
                <span className="h-2.5 rounded-full bg-line">
                  <span className="block h-full rounded-full bg-chart" style={{ width: `${b.ratio * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{Math.round(b.ratio * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-box bg-accent-soft p-4">
            <p className="text-xs text-muted">핵심 문제 1</p>
            <p className="text-3xl font-bold tracking-display text-brand tabular-nums">75%</p>
            <p className="text-sm font-medium">계좌 찾기가 번거롭다</p>
          </div>
          <div className="rounded-box bg-surface p-4">
            <p className="text-xs text-muted">가설 판정</p>
            <p className="text-3xl font-bold tracking-display tabular-nums">그렇다 2</p>
            <p className="text-sm font-medium">아니다 1 · 판단 보류 0</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
