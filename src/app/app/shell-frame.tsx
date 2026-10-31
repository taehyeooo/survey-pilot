"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { IconChart, IconList, IconPlus } from "../icons";

// 웹앱 뼈대 — 왼쪽 메뉴(결정 37, Figma 시안 "03 정돈된 도구". 이전 결정 30 상단 메뉴 바를 바꿈).
// 이용 안내·정지 안내·탈퇴는 한 가지 일만 하는 화면이라 메뉴를 숨긴다(BareMarker → :root[data-bare]).
const BARE = ["/app/welcome", "/app/suspended", "/app/leave"];

const item =
  "flex min-h-11 items-center gap-2.5 rounded-box px-2.5 text-sm text-muted hover:bg-line/60 hover:text-fg aria-[current=page]:bg-line/80 aria-[current=page]:font-semibold aria-[current=page]:text-fg";

export function NavLinks({ operator, count, recent }: { operator: boolean; count: number; recent: { id: string; title: string; live: boolean }[] }) {
  const path = usePathname();
  const current = (on: boolean) => (on ? ("page" as const) : undefined);
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <p className="px-2.5 pb-1 text-xs font-medium text-muted">워크스페이스</p>
        <Link href="/app" aria-current={current(path === "/app")} className={item}>
          <IconList className="size-4.5" />
          <span className="flex-1">내 설문</span>
          <span className="text-xs tabular-nums">{count}</span>
        </Link>
        <Link href="/app/new" aria-current={current(path === "/app/new")} className={item}>
          <IconPlus className="size-4.5" />
          새 설문
        </Link>
        {operator && (
          <Link href="/ops" aria-current={current(path.startsWith("/ops"))} className={item}>
            <IconChart className="size-4.5" />
            운영
          </Link>
        )}
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium text-muted">최근 항목</p>
          {recent.map((s) => (
            <Link key={s.id} href={`/app/surveys/${s.id}`} aria-current={current(path.startsWith(`/app/surveys/${s.id}`))} className={item}>
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${s.live ? "bg-brand" : "bg-muted/50"}`} />
              <span className="truncate">{s.title}</span>
            </Link>
          ))}
        </div>
      )}
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
