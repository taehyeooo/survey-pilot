// Gemini 호출 경계. 실제 구현은 plan 3단계(한도 가드, ADR 0018), 테스트는 test/fakes.ts의 가짜를 쓴다.
export interface AiClient {
  generateJson(prompt: string): Promise<unknown>;
}
