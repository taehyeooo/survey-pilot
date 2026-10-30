"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";
import { confirmSignup, requestReset, resendSignupCode, resetWithCode, signInWithPassword, startSignup } from "@/lib/auth-flow";
import { allowLoginRequest } from "@/lib/login-limit";
import { hashSecret } from "@/lib/mailer-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

// 로그인·가입·비밀번호 재설정(multi-user R-1, spec v2). 화면 단계(mode)는 서버가 정해 돌려준다.
// email은 다음 단계와 오류 뒤 입력 칸을 다시 채우는 데 쓴다(폼 액션은 제출 뒤 폼을 비운다).
export type AuthMode = "login" | "signup" | "verify" | "forgot" | "reset";
export type AuthState = { mode: AuthMode; email?: string; error?: string; info?: string };

const field = (formData: FormData, name: string) => String(formData.get(name) ?? "");

// 인증번호 메일을 보내는 요청(가입·다시 받기·재설정)만 센다 — 낯선 주소로 메일을 계속 보내지 않게.
async function allowMail(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return allowLoginRequest(createAdminClient(), hashSecret(), { ip, email });
}

// 운영자 확인(admins 테이블)은 ADMIN_EMAIL로 로그인할 때 맞춰 둔다.
async function syncOperator(email: string) {
  if (isAdminEmail(email, process.env.ADMIN_EMAIL)) await createAdminClient().from("admins").upsert({ email }).throwOnError();
}

export async function authAction(prev: AuthState, formData: FormData): Promise<AuthState> {
  // 숨은 칸(현재 단계) 뒤에 누른 버튼의 값이 붙는다 — "다시 받기"처럼 버튼이 정하면 그것을 쓴다
  const intent = String(formData.getAll("intent").at(-1) ?? "") as AuthMode | "resend";
  const email = normalizeEmail(field(formData, "email") || prev.email || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { mode: prev.mode, email, error: "이메일 주소를 다시 확인해 주세요." };
  const db = await createSessionClient();
  const tooMany = "인증번호를 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.";

  if (intent === "login") {
    const error = await signInWithPassword(db, email, field(formData, "password"));
    if (error) return { mode: "login", email, error };
    await syncOperator(email);
    redirect("/app");
  }
  if (intent === "signup") {
    if (!(await allowMail(email))) return { mode: "signup", email, error: tooMany };
    const error = await startSignup(db, email, field(formData, "password"));
    return error ? { mode: "signup", email, error } : { mode: "verify", email, info: `${email}로 인증번호 6자리를 보냈어요. 3분 안에 넣어 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.` };
  }
  if (intent === "resend") {
    if (!(await allowMail(email))) return { mode: "verify", email, error: tooMany };
    const error = await resendSignupCode(db, email);
    return error ? { mode: "verify", email, error } : { mode: "verify", email, info: "인증번호를 다시 보냈어요. 3분 안에 넣어 주세요. 메일이 안 보이면 스팸함도 확인해 주세요." };
  }
  if (intent === "verify") {
    const error = await confirmSignup(db, email, field(formData, "code"));
    if (error) return { mode: "verify", email, error };
    await syncOperator(email);
    redirect("/app"); // 처음이면 이용 안내 동의(/app/welcome)로 이어진다
  }
  if (intent === "forgot") {
    if (!(await allowMail(email))) return { mode: "forgot", email, error: tooMany };
    const error = await requestReset(db, email);
    return error ? { mode: "forgot", email, error } : { mode: "reset", email, info: `${email}로 인증번호 6자리를 보냈어요. 3분 안에 넣어 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.` };
  }
  if (intent === "reset") {
    const error = await resetWithCode(db, email, field(formData, "code"), field(formData, "password"));
    if (error) return { mode: "reset", email, error };
    await syncOperator(email);
    redirect("/app");
  }
  return { mode: "login", email };
}

export async function signOut() {
  const db = await createSessionClient();
  await db.auth.signOut();
}
