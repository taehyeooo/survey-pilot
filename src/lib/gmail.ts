import nodemailer from "nodemailer";
import type { Mailer } from "@/lib/mail";

// Gmail SMTP(앱 비밀번호) — 구글 계정 비밀번호가 아니다. 한도는 mailer-runtime에서 감싼다(ADR 0018).
export function createGmailMailer({ user, pass }: { user: string; pass: string }): Mailer {
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  return {
    async send(mail) {
      await transport.sendMail({ from: { name: "서베이 파일럿", address: user }, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}
