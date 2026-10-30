"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// 웹앱 뼈대 — 상단 메뉴 바(디자인 1단계 구조 시안 A, 2026-10-31 사용자 선택. B 왼쪽 사이드바는 고르지 않음).
// 이용 안내·정지 안내·탈퇴는 한 가지 일만 하는 화면이라 메뉴 바를 숨긴다(BareMarker → :root[data-bare]).
const BARE = ["/app/welcome", "/app/suspended", "/app/leave"];

export function NavLinks({ operator }: { operator: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/app", label: "내 설문", active: path === "/app" || path.startsWith("/app/surveys") },
    { href: "/app/new", label: "새 설문", active: path === "/app/new" },
    ...(operator ? [{ href: "/ops", label: "운영", active: path.startsWith("/ops") }] : []),
  ];
  return (
    <nav aria-label="주 메뉴" className="flex items-center gap-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-box px-3 text-sm text-muted hover:bg-surface hover:text-fg aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-fg"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// 주소를 읽는 일은 이 작은 조각만 한다 — Suspense 안에 두어 화면 전체가 주소를 기다리지 않게(Cache Components).
export function BareMarker() {
  const path = usePathname();
  const bare = BARE.some((p) => path.startsWith(p));
  useEffect(() => {
    if (bare) document.documentElement.dataset.bare = "";
    else delete document.documentElement.dataset.bare;
  }, [bare]);
  return null;
}
