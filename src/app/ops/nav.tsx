import Link from "next/link";

// 운영 페이지 머리. 사용자 화면(/app)과 따로 둔다(multi-user R-6).
export function OpsNav({ current }: { current: "overview" | "users" }) {
  const item = (key: typeof current, href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className="inline-flex min-h-11 items-center rounded-box px-3 text-sm aria-[current=page]:bg-surface aria-[current=page]:font-medium"
    >
      {label}
    </Link>
  );
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold">운영</h1>
      <nav className="flex items-center gap-1">
        {item("overview", "/ops", "개요")}
        {item("users", "/ops/users", "사용자")}
        <Link href="/app" className="inline-flex min-h-11 items-center rounded-box px-3 text-sm text-muted hover:bg-surface">
          내 설문
        </Link>
      </nav>
    </header>
  );
}

export const kst = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
