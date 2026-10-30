import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { loadMember, needsAgreement } from "@/lib/members";
import { createSessionClient } from "@/lib/supabase/server";

// 로그인 확인(multi-user R-1). 로그인 안 했으면 로그인으로.
export async function requireSignedIn() {
  // 권한 확인은 요청마다 — 미리 렌더링을 여기서 멈춘다. 없으면 Supabase 세션 확인 안의
  // Date.now()가 미리 렌더링 중에 불려 Next가 "Blocking Route"로 경고한다(Cache Components).
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, user };
}

// 사용자 화면 입구(multi-user R-2). 이용 안내에 동의하기 전이면 안내 화면으로.
export async function requireMember() {
  const session = await requireSignedIn();
  if (needsAgreement(await loadMember(session.db, session.user.id))) redirect("/admin/welcome");
  return session;
}
