import { DAY_MS, MINUTE_MS, withLimit, type UsageStore } from "@/lib/usage";

// Gemini 호출 경계. 실제 Gemini 구현은 plan 4단계, 테스트는 test/fakes.ts의 가짜를 쓴다.
export interface AiClient {
  generateJson(prompt: string): Promise<unknown>;
}

// 분당·하루 한도를 넘으면 부르지 않는다(R-27, ADR 0018).
export function createGuardedAi(
  inner: AiClient,
  store: UsageStore,
  limits: { rpm: number; rpd: number },
  purpose: string,
  now?: () => number,
): AiClient {
  return {
    generateJson: (prompt) =>
      withLimit(
        store,
        { kind: "ai", purpose },
        [
          { windowMs: MINUTE_MS, max: limits.rpm },
          { windowMs: DAY_MS, max: limits.rpd },
        ],
        () => inner.generateJson(prompt),
        now,
      ),
  };
}

// 출력이 스키마(parse)를 통과하지 않으면 한 번만 다시 부른다(R-28).
// 호출 오류·한도 초과는 그대로 던진다 — 다시 부르지 않는다.
export async function generateValid<T>(ai: AiClient, prompt: string, parse: (data: unknown) => T): Promise<T> {
  const first = await ai.generateJson(prompt);
  try {
    return parse(first);
  } catch {
    return parse(await ai.generateJson(prompt));
  }
}
