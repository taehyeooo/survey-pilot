import type { AiClient } from "../src/lib/ai";
import type { Mail, Mailer } from "../src/lib/mail";

// 정해 둔 응답을 차례로 돌려주고, 받은 프롬프트를 남긴다.
export function createFakeAi(responses: unknown[]): AiClient & { prompts: string[] } {
  const queue = [...responses];
  const prompts: string[] = [];
  return {
    prompts,
    async generateJson(prompt) {
      prompts.push(prompt);
      if (queue.length === 0) throw new Error("가짜 AI에 남은 응답이 없다");
      return queue.shift();
    },
  };
}

// 보내지 않고 보낸 메일을 모아 둔다.
export function createFakeMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
}
