import { DAY_MS, withLimit, type UsageStore } from "@/lib/usage";

// 메일 발송 경계. 실제 구현(Gmail SMTP)은 plan 10단계, 테스트는 test/fakes.ts의 가짜를 쓴다.
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

// 최근 24시간 발송이 dailyMax에 닿으면 보내지 않는다(R-29, ADR 0018).
export function createGuardedMailer(inner: Mailer, store: UsageStore, dailyMax: number, now?: () => number): Mailer {
  return {
    send: (mail) =>
      withLimit(store, { kind: "mail", purpose: "otp" }, [{ windowMs: DAY_MS, max: dailyMax }], () => inner.send(mail), now),
  };
}
