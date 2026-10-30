import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { isOperator } from "@/lib/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { LogoMark } from "../icons";
import { NavLinks } from "./shell-frame";

// 상단 메뉴 바 — 로고·주 메뉴·계정. 사용자 화면(/app)과 운영 페이지(/ops)가 함께 쓴다.
// 보여 주기만 한다 — 접근 확인은 화면마다 requireMember·requireOperator가 한다.
async function Account() {
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const operator = user ? await isOperator(createAdminClient(), user.email, process.env.ADMIN_EMAIL) : false;
  return (
    <>
      <NavLinks operator={operator} />
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-sm text-muted md:inline">{user?.email}</span>
        <form action={logout}>
          <button type="submit" className="min-h-11 rounded-box px-3 text-sm text-muted hover:bg-line/50 hover:text-fg">
            로그아웃
          </button>
        </form>
      </div>
    </>
  );
}

export function TopBar() {
  return (
    <header className="shell-top chrome-bar border-b border-line">
      <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center gap-6 px-6">
        <Link href="/app" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold tracking-title">
          <LogoMark className="size-7" />
          서베이 파일럿
        </Link>
        <Suspense>
          <Account />
        </Suspense>
      </div>
    </header>
  );
}
