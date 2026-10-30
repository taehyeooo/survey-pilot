import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

// 이메일(아이디)·비밀번호 로그인과 메일 인증번호(multi-user R-1, spec v2).
// db는 사용자 세션 클라이언트 — 성공하면 그 클라이언트에 세션이 생긴다(서버 액션에서는 쿠키로 남는다).
// 함수는 문제가 없으면 null, 있으면 화면에 보일 문구를 돌려준다.

export const WRONG_LOGIN = "이메일이나 비밀번호가 맞지 않아요."; // 어느 쪽이 틀렸는지 알리지 않는다
const WRONG_CODE = "인증번호가 맞지 않거나 시간이 지났어요. 다시 받아 주세요.";

// 인증번호 유효 시간 — Supabase 설정 Email OTP expiration(180초)과 같아야 한다. 화면 타이머가 쓴다.
export const CODE_TTL_SECONDS = 180;
const TOO_MANY = "요청이 많아요. 잠시 후 다시 시도해 주세요.";

export function passwordProblem(password: string) {
  if (password.length < 8) return "비밀번호는 8자 이상으로 정해 주세요.";
  if (new TextEncoder().encode(password).length > 72) return "비밀번호가 너무 길어요. 조금 짧게 정해 주세요."; // bcrypt는 72바이트까지만 쓴다
  return null;
}

function messageOf(error: AuthError, fallback: string) {
  if (error.status === 429 || error.code?.startsWith("over_")) return TOO_MANY;
  if (error.code === "otp_expired") return WRONG_CODE;
  console.error(error);
  return fallback;
}

export async function signInWithPassword(db: SupabaseClient, email: string, password: string) {
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (!error) return null;
  if (error.code === "email_not_confirmed") return "가입 확인이 아직 끝나지 않았어요. 메일로 받은 인증번호를 넣어 주세요.";
  if (error.code === "invalid_credentials") return WRONG_LOGIN;
  return messageOf(error, "로그인하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

// 가입: Supabase가 "Confirm signup" 메일(양식에 {{ .Token }})로 인증번호를 보낸다.
// 이미 가입한 이메일이어도 Supabase는 같은 응답을 준다 — 가입 여부를 알리지 않는다.
export async function startSignup(db: SupabaseClient, email: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) return problem;
  const { error } = await db.auth.signUp({ email, password });
  return error ? messageOf(error, "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.") : null;
}

export async function resendSignupCode(db: SupabaseClient, email: string) {
  const { error } = await db.auth.resend({ type: "signup", email });
  return error ? messageOf(error, "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.") : null;
}

export async function confirmSignup(db: SupabaseClient, email: string, code: string) {
  const { error } = await db.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  return error ? messageOf(error, WRONG_CODE) : null;
}

// 재설정: "Reset password" 메일(양식에 {{ .Token }})로 인증번호를 보낸다. 없는 이메일이어도 같은 응답.
export async function requestReset(db: SupabaseClient, email: string) {
  const { error } = await db.auth.resetPasswordForEmail(email);
  return error ? messageOf(error, "인증번호를 보내지 못했어요. 잠시 후 다시 시도해 주세요.") : null;
}

// 비밀번호를 먼저 검사한다 — 인증번호는 한 번만 쓰여서, 검사에 걸리면 다시 받아야 하기 때문.
export async function resetWithCode(db: SupabaseClient, email: string, code: string, password: string) {
  const problem = passwordProblem(password);
  if (problem) return problem;
  const { error } = await db.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
  if (error) return messageOf(error, WRONG_CODE);
  const { error: updateError } = await db.auth.updateUser({ password });
  return updateError ? messageOf(updateError, "비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.") : null;
}
