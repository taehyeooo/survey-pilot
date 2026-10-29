// 메일 발송 경계. 실제 구현(Gmail SMTP)은 plan 10단계, 테스트는 test/fakes.ts의 가짜를 쓴다.
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}
