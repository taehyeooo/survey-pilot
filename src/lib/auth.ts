import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { createSessionClient } from "@/lib/supabase/server";

// 관리자 화면 입구(R-1). 로그인 안 했으면 로그인으로, 관리자가 아니면 막는다.
export async function requireAdmin() {
  // 권한 확인은 요청마다 — 미리 렌더링을 여기서 멈춘다. 없으면 Supabase 세션 확인 안의
  // Date.now()가 미리 렌더링 중에 불려 Next가 "Blocking Route"로 경고한다(Cache Components).
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAIL)) redirect("/login?error=forbidden");
  return { db, user };
}
