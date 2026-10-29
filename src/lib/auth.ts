import "server-only";
import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { createSessionClient } from "@/lib/supabase/server";

// 관리자 화면 입구(R-1). 로그인 안 했으면 로그인으로, 관리자가 아니면 막는다.
export async function requireAdmin() {
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAIL)) redirect("/login?error=forbidden");
  return { db, user };
}
