import "server-only";
import { createGuardedAi, type AiClient } from "@/lib/ai";
import { createDemoAi } from "@/lib/demo-ai";
import { createGeminiAi } from "@/lib/gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseUsageStore, readLimits } from "@/lib/usage";

// 실행 중인 앱이 쓰는 AI. 키가 있으면 한도가 걸린 Gemini(ADR 0018), 없으면 개발에서만 데모.
export function isDemoAi() {
  return !process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "production";
}

export function getAi(purpose: string): AiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (isDemoAi()) return createDemoAi();
    throw new Error("GEMINI_API_KEY가 비어 있다");
  }
  const limits = readLimits();
  return createGuardedAi(
    createGeminiAi({ apiKey, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" }),
    createSupabaseUsageStore(createAdminClient()),
    { rpm: limits.geminiRpm, rpd: limits.geminiRpd },
    purpose,
  );
}
