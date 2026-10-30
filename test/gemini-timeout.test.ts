import { describe, expect, it } from "vitest";
import { generateValid } from "../src/lib/ai";
import { createGeminiAi } from "../src/lib/gemini";

// 응답하지 않는 fetch — signal이 끊기면 AbortError로 거부한다(실제 fetch처럼)
const hangingFetch = (calls: { count: number }) =>
  ((_url: string | URL | Request, init?: RequestInit) => {
    calls.count++;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    });
  }) as typeof fetch;

describe("Gemini 요청 시간 제한", () => {
  // survey-pilot#R-28 — 2026-10-30 요청 하나가 9시간 멈춘 일
  it("응답이 없으면 정한 시간 뒤 '시간 초과' 오류로 끝난다", async () => {
    const calls = { count: 0 };
    const ai = createGeminiAi({ apiKey: "k", model: "m", fetchFn: hangingFetch(calls), timeoutMs: 50 });
    const started = Date.now();
    await expect(ai.generateJson("p")).rejects.toThrow(/시간 초과/);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  // survey-pilot#R-28
  it("시간 초과는 스키마 실패가 아니라서 다시 부르지 않는다", async () => {
    const calls = { count: 0 };
    const ai = createGeminiAi({ apiKey: "k", model: "m", fetchFn: hangingFetch(calls), timeoutMs: 50 });
    await expect(generateValid(ai, "p", (d) => d)).rejects.toThrow(/시간 초과/);
    expect(calls.count).toBe(1);
  });
});
