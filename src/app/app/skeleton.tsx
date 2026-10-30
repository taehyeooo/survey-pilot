// 불러오는 중 — 글자 대신 화면 모양을 먼저 보여 준다(자리가 튀지 않게). 움직임 줄이기면 깜빡이지 않는다.
const block = "rounded-box bg-line/60 motion-safe:animate-pulse";

export function CardsSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card flex flex-col gap-4 p-5">
          <div className={`h-16 ${block}`} />
          <div className={`h-8 w-24 ${block}`} />
          <div className={`h-2 ${block}`} />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="flex flex-col gap-6">
      <div className={`h-6 w-28 ${block}`} />
      <div className={`h-12 w-2/3 ${block}`} />
      <div className={`h-2 ${block}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={`h-64 ${block}`} />
        <div className={`h-48 ${block}`} />
      </div>
    </div>
  );
}
