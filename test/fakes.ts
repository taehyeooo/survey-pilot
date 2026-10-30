import type { AiClient } from "../src/lib/ai";
import type { Mail, Mailer } from "../src/lib/mail";
import type { UsageEvent, UsageKind, UsageStore } from "../src/lib/usage";

// 정해 둔 응답을 차례로 돌려주고, 받은 프롬프트를 남긴다. Error를 넣으면 그 차례에 던진다.
export function createFakeAi(responses: unknown[]): AiClient & { prompts: string[] } {
  const queue = [...responses];
  const prompts: string[] = [];
  return {
    prompts,
    async generateJson(prompt) {
      prompts.push(prompt);
      if (queue.length === 0) throw new Error("가짜 AI에 남은 응답이 없다");
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
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

// usage_events 대신 메모리에 남긴다. now로 시각을 정한다.
export function createMemoryUsageStore(now: () => number = Date.now): UsageStore & {
  events: (UsageEvent & { createdAt: number })[];
} {
  const events: (UsageEvent & { createdAt: number })[] = [];
  return {
    events,
    async window(kind: UsageKind, since: Date) {
      const used = events.filter((e) => e.kind === kind && e.status !== "blocked" && e.createdAt >= since.getTime());
      const oldest = used.length ? new Date(Math.min(...used.map((e) => e.createdAt))) : null;
      return { count: used.length, oldest };
    },
    async record(event) {
      events.push({ ...event, createdAt: now() });
      return String(events.length - 1);
    },
    async settle(id, status) {
      events[Number(id)].status = status;
    },
  };
}
