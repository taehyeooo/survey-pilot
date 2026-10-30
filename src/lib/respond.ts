import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "@/lib/admin";
import type { Mailer } from "@/lib/mail";

// 응답자 동의(R-3)·스팸 방지(R-4)·이메일 인증번호(R-18)·마감 안내(R-20).
// db는 서버(service role) 클라이언트 — 응답자 쪽은 DB에 직접 닿지 않는다(ADR 0019).
// 이메일·IP·인증번호는 HASH_SECRET을 섞은 HMAC으로만 저장한다(ADR 0017).

export const CODE_TTL_MS = 10 * 60_000;
export const RESEND_MS = 60_000;
export const MAX_ATTEMPTS = 5;
export const TOKEN_TTL_MS = 30 * 60_000;
export const IP_CODE_LIMIT = 5; // 같은 IP, 1시간
const HOUR_MS = 60 * 60_000;

export type RespondErrorCode = "consent" | "closed" | "email" | "ip" | "done" | "wait" | "invalid" | "expired" | "locked";

export class RespondError extends Error {
  name = "RespondError";
  constructor(
    message: string,
    readonly code: RespondErrorCode,
  ) {
    super(message);
  }
}

export const hmac = (secret: string, value: string) => createHmac("sha256", secret).update(value).digest("base64url");
export const emailHashOf = (secret: string, email: string) => hmac(secret, `email:${normalizeEmail(email)}`);
export const ipHashOf = (secret: string, ip: string) => hmac(secret, `ip:${ip}`);
export const makeCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const codeHashOf = (secret: string, surveyId: string, emailHash: string, code: string) => hmac(secret, `code:${surveyId}:${emailHash}:${code}`);

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// 인증 뒤 제출까지 쓰는 토큰: `응답자id.만료시각.서명`, 30분(R-18).
export function makeToken(secret: string, respondentId: string, now = Date.now()) {
  const body = `${respondentId}.${now + TOKEN_TTL_MS}`;
  return `${body}.${hmac(secret, `token:${body}`)}`;
}

export function readToken(secret: string, token: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, signature] = parts;
  if (!sameText(signature, hmac(secret, `token:${id}.${exp}`))) return null;
  return Number(exp) > now ? id : null;
}

export interface OpenSurvey {
  id: string;
  status: string;
  archived_at: string | null;
  closes_at: string | null;
  paused?: boolean; // 설문 주인이 정지됨(multi-user R-8)
}

export const PAUSED = "지금은 응답을 받지 않아요.";

export function isClosed(survey: OpenSurvey, now = Date.now()) {
  return survey.status !== "published" || Boolean(survey.archived_at) || (survey.closes_at !== null && Date.parse(survey.closes_at) <= now);
}

async function hasResponded(db: SupabaseClient, surveyId: string, emailHash: string) {
  const { data } = await db
    .from("respondents")
    .select("id, responses(id)")
    .eq("survey_id", surveyId)
    .eq("email_hash", emailHash)
    .maybeSingle()
    .throwOnError();
  return Boolean(data?.responses && (Array.isArray(data.responses) ? data.responses.length : true));
}

export async function requestCode(
  db: SupabaseClient,
  mailer: Mailer,
  secret: string,
  input: { survey: OpenSurvey; email: string; consent: boolean; honeypot: string; ip: string },
  now = Date.now(),
): Promise<"sent" | "ignored"> {
  if (input.honeypot.trim()) return "ignored"; // 봇에게는 성공처럼(R-4)
  if (!input.consent) throw new RespondError("개인정보 수집·이용에 동의해야 응답할 수 있어요.", "consent");
  if (isClosed(input.survey, now)) throw new RespondError("마감된 설문이에요.", "closed");
  if (input.survey.paused) throw new RespondError(PAUSED, "closed");
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RespondError("이메일 주소를 다시 확인해 주세요.", "email");

  const ipHash = ipHashOf(secret, input.ip);
  const { count } = await db
    .from("verifications")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gt("sent_at", new Date(now - HOUR_MS).toISOString())
    .throwOnError();
  if ((count ?? 0) >= IP_CODE_LIMIT) throw new RespondError("요청이 많아요. 잠시 후 다시 시도해 주세요.", "ip");

  const emailHash = emailHashOf(secret, email);
  if (await hasResponded(db, input.survey.id, emailHash)) throw new RespondError("이미 응답하셨어요. 참여해 주셔서 고마워요.", "done");

  const { data: last } = await db
    .from("verifications")
    .select("sent_at")
    .eq("survey_id", input.survey.id)
    .eq("email_hash", emailHash)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (last && now - Date.parse(last.sent_at) < RESEND_MS) throw new RespondError("인증번호는 1분에 한 번 받을 수 있어요.", "wait");

  const code = makeCode();
  await db
    .from("verifications")
    .insert({
      survey_id: input.survey.id,
      email_hash: emailHash,
      code_hash: codeHashOf(secret, input.survey.id, emailHash, code),
      expires_at: new Date(now + CODE_TTL_MS).toISOString(),
      sent_at: new Date(now).toISOString(),
      ip_hash: ipHash,
    })
    .throwOnError();
  await mailer.send({
    to: email,
    subject: `[서베이 파일럿] 인증번호 ${code}`,
    text: `인증번호: ${code}\n\n10분 안에 설문 화면에 입력해 주세요.\n요청하지 않았다면 이 메일은 무시해 주세요.`,
  });
  return "sent";
}

export async function verifyCode(
  db: SupabaseClient,
  secret: string,
  input: { survey: OpenSurvey; email: string; code: string },
  now = Date.now(),
) {
  if (isClosed(input.survey, now)) throw new RespondError("마감된 설문이에요.", "closed");
  if (input.survey.paused) throw new RespondError(PAUSED, "closed");
  const email = normalizeEmail(input.email);
  const emailHash = emailHashOf(secret, email);
  const { data: v } = await db
    .from("verifications")
    .select("id, code_hash, expires_at, attempts")
    .eq("survey_id", input.survey.id)
    .eq("email_hash", emailHash)
    .is("consumed_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .throwOnError();
  if (!v) throw new RespondError("인증번호를 먼저 받아 주세요.", "invalid");
  if (Date.parse(v.expires_at) <= now) throw new RespondError("인증번호가 만료됐어요. 다시 받아 주세요.", "expired");
  if (v.attempts >= MAX_ATTEMPTS) throw new RespondError("틀린 횟수가 많아요. 인증번호를 다시 받아 주세요.", "locked");
  if (!sameText(v.code_hash, codeHashOf(secret, input.survey.id, emailHash, input.code.trim()))) {
    await db.from("verifications").update({ attempts: v.attempts + 1 }).eq("id", v.id).throwOnError();
    const left = MAX_ATTEMPTS - v.attempts - 1;
    throw new RespondError(left > 0 ? `인증번호가 맞지 않아요. ${left}번 더 시도할 수 있어요.` : "틀린 횟수가 많아요. 인증번호를 다시 받아 주세요.", left > 0 ? "invalid" : "locked");
  }
  await db.from("verifications").update({ consumed_at: new Date(now).toISOString() }).eq("id", v.id).throwOnError();

  const at = new Date(now).toISOString();
  const { data: existing } = await db
    .from("respondents")
    .select("id, responses(id)")
    .eq("survey_id", input.survey.id)
    .eq("email_hash", emailHash)
    .maybeSingle()
    .throwOnError();
  if (existing?.responses && (Array.isArray(existing.responses) ? existing.responses.length : true)) {
    throw new RespondError("이미 응답하셨어요. 참여해 주셔서 고마워요.", "done");
  }
  let respondentId = existing?.id as string | undefined;
  if (respondentId) {
    await db.from("respondents").update({ verified_at: at }).eq("id", respondentId).throwOnError();
  } else {
    const { data } = await db
      .from("respondents")
      .insert({ survey_id: input.survey.id, email_hash: emailHash, email, consented_at: at, verified_at: at })
      .select("id")
      .single()
      .throwOnError();
    respondentId = data.id as string;
  }
  return makeToken(secret, respondentId, now);
}
