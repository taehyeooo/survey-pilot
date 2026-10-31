import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { isOperator } from "@/lib/operator";
import { listSurveys } from "@/lib/surveys";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { LogoMark } from "../icons";
import { NavLinks } from "./shell-frame";

// 왼쪽 메뉴(결정 37, 시안 "03 정돈된 도구") — 로고·주 메뉴·최근 설문·계정. 사용자 화면(/app)과 운영 페이지(/ops)가 함께 쓴다.
// 보여 주기만 한다 — 접근 확인은 화면마다 requireMember·requireOperator가 한다.
async function SideContent() {
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const [operator, surveys] = await Promise.all([isOperator(createAdminClient(), user.email, process.env.ADMIN_EMAIL), listSurveys(db, user.id)]);
  const live = surveys.filter((s) => !s.archived_at);
  const recent = live.slice(0, 5).map((s) => ({ id: s.id, title: s.problem, live: s.status === "published" }));
  return (
    <>
      <NavLinks operator={operator} count={live.length} recent={recent} />
      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-brand uppercase">
          {user.email?.[0] ?? "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">{user.email}</span>
        <form action={logout}>
          <button type="submit" className="min-h-11 rounded-box px-2 text-sm text-muted hover:bg-line/60 hover:text-fg">
            로그아웃
          </button>
        </form>
      </div>
    </>
  );
}

export function SideBar() {
  return (
    <aside className="shell-side flex flex-col gap-5 border-b border-line bg-surface px-3 py-4 md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
      <Link href="/app" aria-label="서베이 파일럿" className="inline-flex min-h-11 items-center gap-2.5 px-2 text-base font-semibold tracking-title">
        <LogoMark />
        <span>서베이 파일럿</span>
      </Link>
      <Suspense>
        <SideContent />
      </Suspense>
    </aside>
  );
}
