import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHashOf, ipHashOf } from "@/lib/respond";

// 로그인 링크 요청 횟수 제한(multi-user R-1). 누구나 아무 이메일로 요청할 수 있어,
// 우리 Gmail이 낯선 주소에 계속 보내지 않게 막는다. IP·이메일은 HMAC 해시로만 남긴다(ADR 0017).
export const LOGIN_IP_LIMIT = 5; // 같은 IP, 1시간
const HOUR_MS = 3_600_000;
const EMAIL_GAP_MS = 60_000; // 같은 이메일, 1분에 1회
const KEEP_MS = 24 * HOUR_MS;

// 허용하면 요청을 기록하고 true. 넘으면 기록하지 않고 false.
export async function allowLoginRequest(db: SupabaseClient, secret: string, input: { ip: string; email: string }, now = Date.now()) {
  const ipHash = ipHashOf(secret, input.ip);
  const emailHash = emailHashOf(secret, input.email); // 대소문자·공백은 해시 함수가 맞춘다
  const since = (ms: number) => new Date(now - ms).toISOString();

  const [{ count: byIp }, { count: byEmail }] = await Promise.all([
    db.from("login_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gt("created_at", since(HOUR_MS)).throwOnError(),
    db.from("login_attempts").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gt("created_at", since(EMAIL_GAP_MS)).throwOnError(),
  ]);
  if ((byIp ?? 0) >= LOGIN_IP_LIMIT || (byEmail ?? 0) > 0) return false;

  await db.from("login_attempts").insert({ ip_hash: ipHash, email_hash: emailHash, created_at: new Date(now).toISOString() }).throwOnError();
  await db.from("login_attempts").delete().lt("created_at", since(KEEP_MS)).throwOnError(); // 하루 지난 기록은 쓸 데가 없다
  return true;
}
