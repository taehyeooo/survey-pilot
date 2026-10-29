"use server";

import { headers } from "next/headers";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

// email은 오류 뒤 입력 칸을 다시 채우는 데 쓴다(폼 액션은 제출 뒤 폼을 비운다).
export type LoginState = { error?: string; sent?: string; email?: string };

export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일 주소를 다시 확인해 주세요.", email };
  // 관리자가 아니면 Supabase에 보내지도 않는다(R-1).
  if (!isAdminEmail(email, process.env.ADMIN_EMAIL)) return { error: "관리자만 로그인할 수 있어요.", email };

  // DB 권한(is_admin)은 admins 테이블을 본다 — 로그인할 때 맞춰 둔다.
  await createAdminClient().from("admins").upsert({ email }).throwOnError();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const db = await createSessionClient();
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) {
    return {
      error:
        error.status === 429
          ? "로그인 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요."
          : "로그인 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
      email,
    };
  }
  return { sent: email };
}

export async function signOut() {
  const db = await createSessionClient();
  await db.auth.signOut();
}
