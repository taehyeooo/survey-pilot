import type { AiClient } from "@/lib/ai";

// Gemini REST(generateContent). 키는 주소가 아니라 헤더로 보낸다 — 주소는 로그에 남기 쉽다.
// 모델 이름과 무료 한도는 바뀔 수 있어 환경변수로 받는다(ADR 0018). 실제 품질 검증은 plan 4단계.
// 시간 제한: 응답이 없으면 timeoutMs 뒤 끊는다 — 없으면 요청 하나가 몇 시간씩 멈춘다(2026-10-30 9시간 실측).
export function createGeminiAi({
  apiKey,
  model,
  fetchFn = fetch,
  timeoutMs = 45_000,
}: {
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): AiClient {
  return {
    async generateJson(prompt) {
      let res: Response;
      let body: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      try {
        const signal = AbortSignal.timeout(timeoutMs);
        res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
          }),
          signal,
        });
        if (!res.ok) throw new Error(`Gemini 요청 실패 (HTTP ${res.status})`);
        body = await res.json();
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          throw new Error(`Gemini 응답 시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
        }
        throw error;
      }
      const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) throw new Error("Gemini가 빈 답을 돌려줬다");
      try {
        return JSON.parse(text);
      } catch {
        return text; // JSON이 아니면 스키마 검사에서 걸려 1번 다시 부른다(R-28)
      }
    },
  };
}
