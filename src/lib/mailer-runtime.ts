import "server-only";
import { createGmailMailer } from "@/lib/gmail";
import { createGuardedMailer, type Mailer } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseUsageStore, readLimits } from "@/lib/usage";

// 실행 중인 앱이 쓰는 메일러. Gmail 설정이 있으면 하루 한도(MAIL_DAILY_LIMIT)를 건 Gmail,
// 없으면 개발에서만 서버 콘솔에 찍는다(실제로 보내지 않음). 배포에서 설정이 없으면 오류.
export function getMailer(): Mailer {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (user && pass) {
    return createGuardedMailer(createGmailMailer({ user, pass }), createSupabaseUsageStore(createAdminClient()), readLimits().mailDaily);
  }
  if (process.env.NODE_ENV === "production") throw new Error("GMAIL_USER·GMAIL_APP_PASSWORD가 비어 있다");
  return {
    async send(mail) {
      console.info(`[개발 메일] ${mail.to} — ${mail.subject}`);
    },
  };
}

export function hashSecret() {
  const secret = process.env.HASH_SECRET;
  if (!secret) throw new Error("HASH_SECRET이 비어 있다");
  return secret;
}
