import type { SupabaseClient } from "@supabase/supabase-js";

// 무료 한도 가드(ADR 0018) — 부르기 전에 usage_events로 세고, 넘으면 부르지 않는다.
// 하루는 제공자의 초기화 시각을 모르므로 "최근 24시간"으로 센다.
// 세기와 부르기 사이가 원자적이지 않아 동시에 부르면 1건 넘을 수 있다(관리자 1명이라 받아들임).

export type UsageKind = "ai" | "mail";
export type UsageStatus = "ok" | "error" | "blocked";

export interface UsageEvent {
  kind: UsageKind;
  purpose: string;
  status: UsageStatus;
  surveyId?: string | null;
}

export interface UsageStore {
  // since 이후 실제로 부른(blocked 아닌) 건수와 그중 가장 오래된 시각
  window(kind: UsageKind, since: Date): Promise<{ count: number; oldest: Date | null }>;
  record(event: UsageEvent): Promise<void>;
}

export interface Limit {
  windowMs: number;
  max: number;
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export class LimitExceededError extends Error {
  constructor(
    readonly kind: UsageKind,
    readonly retryAfterSeconds: number,
  ) {
    super(`${kind} 사용 한도 초과 — 약 ${retryAfterSeconds}초 뒤 다시`);
    this.name = "LimitExceededError";
  }
}

export async function withLimit<T>(
  store: UsageStore,
  event: Omit<UsageEvent, "status">,
  limits: Limit[],
  call: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const t = now();
  for (const { windowMs, max } of limits) {
    const { count, oldest } = await store.window(event.kind, new Date(t - windowMs));
    if (count >= max) {
      await store.record({ ...event, status: "blocked" });
      const freeAt = (oldest?.getTime() ?? t) + windowMs; // 가장 오래된 호출이 창에서 빠지는 시각
      throw new LimitExceededError(event.kind, Math.max(1, Math.ceil((freeAt - t) / 1000)));
    }
  }
  try {
    const result = await call();
    await store.record({ ...event, status: "ok" });
    return result;
  } catch (error) {
    await store.record({ ...event, status: "error" });
    throw error;
  }
}

export function readLimits(env: Record<string, string | undefined> = process.env) {
  const num = (name: string, fallback: number) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`환경변수 ${name}은(는) 0 이상의 정수여야 한다: "${raw}"`);
    return value;
  };
  return {
    geminiRpm: num("GEMINI_RPM", 5),
    geminiRpd: num("GEMINI_RPD", 20),
    mailDaily: num("MAIL_DAILY_LIMIT", 100),
  };
}

// 서버(service role) 클라이언트를 받는다 — usage_events는 정책이 없어 서버만 읽고 쓴다(ADR 0019).
export function createSupabaseUsageStore(db: SupabaseClient): UsageStore {
  return {
    async window(kind, since) {
      const { data, count } = await db
        .from("usage_events")
        .select("created_at", { count: "exact" })
        .eq("kind", kind)
        .neq("status", "blocked")
        .gte("created_at", since.toISOString())
        .order("created_at")
        .limit(1)
        .throwOnError();
      return { count: count ?? 0, oldest: data?.[0] ? new Date(data[0].created_at) : null };
    },
    async record({ kind, purpose, status, surveyId }) {
      await db.from("usage_events").insert({ kind, purpose, status, survey_id: surveyId ?? null }).throwOnError();
    },
  };
}
