// 프롬프트 샘플 검증(plan 4단계, ADR 0003) — docs/samples/problems.md의 문제를 실제 Gemini로 돌려 결과를 JSON으로 남긴다.
// 앱과 같은 한도 가드(usage_events, ADR 0018)를 거친다 — 무료 한도를 앱과 함께 쓴다.
// 사용: npx -y tsx@4.19.2 --env-file=.env.local scripts/sample_run.ts --from 1 --to 6 [--questions 1] --out docs/samples/runs/2026-10-30.json
// --pick 1,3,13: 번호를 골라 돌린다(--from·--to 대신). --questions n: n번 문제는 설계 뒤 문항 생성·점검까지 돌린다(호출 2회 추가).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createGuardedAi, generateValid, type AiClient } from "../src/lib/ai";
import { ClarifySchema, clarifyPrompt, DesignSchema, designPrompt, type Clarification } from "../src/lib/design";
import { createGeminiAi, DEFAULT_GEMINI_MODEL } from "../src/lib/gemini";
import { estimateSeconds, generatePrompt, parseQuestions, reviewPrompt } from "../src/lib/questions";
import { createSupabaseUsageStore, readLimits } from "../src/lib/usage";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const from = Number(arg("from", "1"));
const to = Number(arg("to", "6"));
const pick = new Set((arg("pick", "") ?? "").split(",").filter(Boolean).map(Number));
const withQuestions = new Set((arg("questions", "") ?? "").split(",").filter(Boolean).map(Number));
const out = arg("out", "docs/samples/runs/run.json")!;
const pauseMs = Number(arg("pause", "13000")); // 분당 5회 한도 아래로

const rows = readFileSync("docs/samples/problems.md", "utf8")
  .split(/\r?\n/) // CRLF로 저장·체크아웃될 수 있다(Windows, core.autocrlf) — "\n"만으로 나누면 줄 끝 \r 때문에 한 줄도 안 맞는다
  .map((l) => l.match(/^\| (\d+) \| (명확|모호|편향) \| (.+) \|$/))
  .filter((m): m is RegExpMatchArray => Boolean(m))
  .map((m) => ({ n: Number(m[1]), kind: m[2], problem: m[3] }));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const limits = readLimits();
const ai: AiClient = createGuardedAi(
  createGeminiAi({ apiKey: process.env.GEMINI_API_KEY!, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 45_000 }),
  createSupabaseUsageStore(db),
  { rpm: limits.geminiRpm, rpd: limits.geminiRpd },
  "sample",
);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const timed = async <T>(fn: () => Promise<T>) => {
  const t = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t };
};

// CommonJS(package.json에 "type": "module" 없음)라 최상위 await 대신 main()
async function main() {
  const results: unknown[] = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : [];
  // 샘플마다 저장 — 중간에 끊겨도 결과가 남게(2026-10-30 메모리 부족으로 종료되며 결과가 사라짐)
  const save = () => {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
  };
  const selected = rows.filter((r) => (pick.size ? pick.has(r.n) : r.n >= from && r.n <= to));
  if (!selected.length) throw new Error(`고른 문제가 0건이다 (표에서 읽은 행 ${rows.length}건)`); // 조용히 0건 저장하지 않게
  for (const row of selected) {
    const result: Record<string, unknown> = { ...row };
    try {
      const clarify = await timed(() => generateValid(ai, clarifyPrompt(row.problem), (d) => ClarifySchema.parse(d)));
      result.clarify = { ms: clarify.ms, questions: clarify.value.questions };
      await sleep(pauseMs);
      // 되묻기에는 첫 선택지로 답했다고 본다(검증용)
      const answers: Clarification[] = clarify.value.questions.map((q) => ({ ...q, answer: q.options[0] }));
      const design = await timed(() => generateValid(ai, designPrompt(row.problem, answers), (d) => DesignSchema.parse(d)));
      result.design = { ms: design.ms, ...design.value };
      await sleep(pauseMs);
      if (withQuestions.has(row.n)) {
        const n = design.value.hypotheses.length;
        const input = { problem: row.problem, purpose: design.value.purpose, audience: design.value.audience, target_minutes: design.value.target_minutes };
        const generated = await timed(() => generateValid(ai, generatePrompt(input, design.value.hypotheses), (d) => parseQuestions(d, n)));
        await sleep(pauseMs);
        const reviewed = await timed(() => generateValid(ai, reviewPrompt(generated.value), (d) => parseQuestions(d, n)));
        result.questions = { generated: generated.value, reviewed: reviewed.value, seconds: estimateSeconds(reviewed.value), ms: generated.ms + reviewed.ms };
        await sleep(pauseMs);
      }
    } catch (error) {
      result.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error(`#${row.n} 실패: ${result.error}`);
      results.push(result);
      save();
      if (error instanceof Error && error.name === "LimitExceededError") break; // 한도면 멈춘다
      continue;
    }
    results.push(result);
    save(); // push 뒤에 — 앞에 두면 저장이 한 건씩 늦고 마지막 샘플이 빠진다
    console.log(`#${row.n} ${row.kind} 완료 — 되묻기 ${(result.clarify as { questions: unknown[] }).questions.length}개`);
  }
  console.log(`저장: ${out} (${results.length}건)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
