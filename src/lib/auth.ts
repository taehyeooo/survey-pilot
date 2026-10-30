import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isSuspended, loadMember, needsAgreement } from "@/lib/members";
import { isOperator } from "@/lib/operator";
import { createAdminClient } from "@/lib/supabase/admin";
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

// 사용자 화면 입구. 정지됐으면 정지 안내로(multi-user R-8), 이용 안내에 동의하기 전이면 동의 화면으로(R-2).
export async function requireMember() {
  const session = await requireSignedIn();
  const member = await loadMember(session.db, session.user.id);
  if (isSuspended(member)) redirect("/app/suspended");
  if (needsAgreement(member)) redirect("/app/welcome");
  return session;
}

// 운영 페이지 입구(multi-user R-10). 운영자가 아니면 없는 페이지처럼 404 — 운영 페이지가 있다는 것도 알리지 않는다.
// 레이아웃이 아니라 화면·액션마다 부른다(test/ops-guard.test.ts가 전수 검사).
export async function requireOperator() {
  const session = await requireSignedIn();
  if (!(await isOperator(createAdminClient(), session.user.email, process.env.ADMIN_EMAIL))) notFound();
  return session;
}
