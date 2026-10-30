"use server";

import { headers } from "next/headers";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";
import { allowLoginRequest } from "@/lib/login-limit";
import { hashSecret } from "@/lib/mailer-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

// email은 오류 뒤 입력 칸을 다시 채우는 데 쓴다(폼 액션은 제출 뒤 폼을 비운다).
export type LoginState = { error?: string; sent?: string; email?: string };

export async function sendLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일 주소를 다시 확인해 주세요.", email };

  // 누구나 가입한다(multi-user R-1). 낯선 주소로 메일을 계속 보내지 않게 횟수를 먼저 센다.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const admin = createAdminClient();
  if (!(await allowLoginRequest(admin, hashSecret(), { ip, email }))) {
    return { error: "로그인 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.", email };
  }
  // 운영자 확인(admins 테이블)은 ADMIN_EMAIL로 로그인할 때 맞춰 둔다.
  if (isAdminEmail(email, process.env.ADMIN_EMAIL)) await admin.from("admins").upsert({ email }).throwOnError();

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
