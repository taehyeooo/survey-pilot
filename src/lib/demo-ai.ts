import type { AiClient } from "@/lib/ai";

// GEMINI_API_KEY가 없을 때 개발 환경에서만 쓰는 데모 AI — 화면 흐름을 눌러 보기 위한 정해 둔 답.
// 배포(production)에서는 쓰지 않는다(src/lib/ai-runtime.ts). 문구에 [데모]를 붙여 실제 AI와 헷갈리지 않게 한다.
export function createDemoAi(): AiClient {
  return {
    async generateJson(prompt) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const problem = prompt.match(/<problem>\n([\s\S]*?)\n<\/problem>/)?.[1] ?? "";
      if (prompt.startsWith("[작업:되묻기]")) {
        if (problem.length >= 30) return { questions: [] };
        return {
          questions: [
            { question: "[데모] 누구에게 물어볼까요?", options: ["팀원·회원", "고객·사용자", "학생"] },
            { question: "[데모] 결과로 무엇을 정하려고 하나요?", options: ["원인 찾기", "개선 방향 정하기", "새 아이디어 확인"] },
          ],
        };
      }
      if (prompt.startsWith("[작업:설계]")) {
        return {
          purpose: `[데모] "${problem.slice(0, 30)}"의 원인을 찾는다`,
          hypotheses: ["[데모] 시간대가 맞지 않는다", "[데모] 내용이 기대와 다르다", "[데모] 참여 동기가 약해졌다"],
          audience: "[데모] 최근 3개월 참여자",
          target_responses: 30,
          target_minutes: 3,
          intro: "[데모] 더 나은 모임을 만들려고 의견을 듣고 있어요. 3분이면 끝나요.",
          share_message: "[데모] 3분짜리 설문이에요. 솔직한 의견 부탁해요!",
        };
      }
      if (prompt.startsWith("[작업:문항 다시]")) {
        return { questions: [{ hypothesis: 1, type: "scale", prompt: "[데모] 다시 만든 문항이에요. 얼마나 그렇다고 느끼나요?", options: [], required: true, review_note: null }] };
      }
      if (prompt.startsWith("[작업:문항]")) {
        const count = (prompt.match(/<hypotheses>\n([\s\S]*?)\n<\/hypotheses>/)?.[1] ?? "").split("\n").filter(Boolean).length;
        return {
          questions: Array.from({ length: Math.max(count, 1) }, (_, i) => [
            { hypothesis: i + 1, type: "single", prompt: `[데모] 가설 ${i + 1}에 대해 어떻게 생각하나요?`, options: ["그렇다", "아니다", "잘 모르겠다"], required: true, review_note: null },
            { hypothesis: i + 1, type: "scale", prompt: `[데모] 가설 ${i + 1}이 얼마나 맞다고 느끼나요?`, options: [], required: true, review_note: null },
          ]).flat(),
        };
      }
      if (prompt.startsWith("[작업:점검]")) {
        const { questions } = JSON.parse(prompt.match(/<questions>\n([\s\S]*?)\n<\/questions>/)?.[1] ?? '{"questions":[]}');
        return {
          questions: questions.map((q: { prompt: string }, i: number) =>
            i === 0 ? { ...q, prompt: q.prompt.replace("어떻게 생각하나요", "어느 쪽에 가깝나요"), review_note: "[데모] 답을 암시하지 않게 바꿨어요" } : q,
          ),
        };
      }
      throw new Error("데모 AI가 모르는 작업이다");
    },
  };
}
