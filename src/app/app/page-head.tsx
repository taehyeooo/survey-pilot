import Link from "next/link";
import type { ReactNode } from "react";

// 본문 맨 위 띠(결정 37) — 왼쪽은 지금 위치(내 설문 / 설문 제목), 오른쪽은 이 화면의 주 버튼.
export function PageHead({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children?: ReactNode }) {
  return (
    <header className="no-print flex min-h-16 items-center justify-between gap-4 border-b border-line px-6 md:px-8">
      <nav aria-label="현재 위치" className="min-w-0 truncate text-sm text-muted">
        {crumbs.map((c, i) => (
          <span key={c.label}>
            {i > 0 && <span aria-hidden> / </span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-fg hover:underline">
                {c.label}
              </Link>
            ) : (
              <span className="text-fg">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}
