import Link from "next/link";

// 운영 페이지 제목과 안쪽 탭. 상단 메뉴 바는 ops/layout.tsx가 사용자 화면과 같은 것을 쓴다(multi-user R-6).
export function OpsNav({ current }: { current: "overview" | "users" | "surveys" | "requests" }) {
  const item = (key: typeof current, href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className="inline-flex min-h-11 items-center rounded-box px-3 text-sm text-muted hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-fg"
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-8 flex flex-col gap-4">
      <h1 className="text-3xl font-bold">운영</h1>
      <nav aria-label="운영 메뉴" className="flex flex-wrap items-center gap-1 border-b border-line pb-2">
        {item("overview", "/ops", "개요")}
        {item("users", "/ops/users", "사용자")}
        {item("surveys", "/ops/surveys", "설문")}
        {item("requests", "/ops/requests", "삭제 요청")}
      </nav>
    </header>
  );
}

export const kst = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
