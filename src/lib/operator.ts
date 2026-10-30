import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";
import { DAY_MS, readLimits } from "@/lib/usage";

// 운영 페이지가 읽는 것(multi-user R-10, R-11, R-13). 모두 서버 클라이언트(RLS 우회)로 읽으므로
// 고르는 컬럼을 목록·숫자로만 둔다 — 남의 설문 문항·응답은 고르지 않는다(ADR 0020).

// 운영자: ADMIN_EMAIL이고 admins 표에도 있을 때만(ADR 0019 v2).
export async function isOperator(db: SupabaseClient, email: string | null | undefined, adminEmail: string | null | undefined) {
  if (!email || !isAdminEmail(email, adminEmail)) return false;
  const { data } = await db.from("admins").select("email").eq("email", normalizeEmail(email)).maybeSingle().throwOnError();
  return Boolean(data);
}

export interface OpsUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  surveys: number;
  ai24h: number;
  suspended: boolean;
}

function countBy<T>(rows: T[], key: (row: T) => string | null) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// 최근 24시간 실제로 부른(blocked 아닌) 사용 기록
async function recentUsage(db: SupabaseClient, now: number) {
  const { data } = await db
    .from("usage_events")
    .select("kind, user_id")
    .neq("status", "blocked")
    .gte("created_at", new Date(now - DAY_MS).toISOString())
    .throwOnError();
  return (data ?? []) as { kind: "ai" | "mail"; user_id: string | null }[];
}

async function lastSignIns(db: SupabaseClient) {
  const signIns = new Map<string, string | null>();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) signIns.set(u.id, u.last_sign_in_at ?? null);
    if (data.users.length < 1000) return signIns;
  }
}

// 사용자 목록(R-11): 가입일 최신순
export async function listUsers(db: SupabaseClient, now = Date.now()): Promise<OpsUser[]> {
  const [{ data: profiles }, { data: surveys }, usage, signIns] = await Promise.all([
    db.from("profiles").select("id, email, created_at, suspended_at").order("created_at", { ascending: false }).throwOnError(),
    db.from("surveys").select("owner_id").throwOnError(),
    recentUsage(db, now),
    lastSignIns(db),
  ]);
  const surveyCounts = countBy(surveys ?? [], (s) => s.owner_id);
  const aiCounts = countBy(usage.filter((u) => u.kind === "ai"), (u) => u.user_id);
  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    createdAt: p.created_at,
    lastSignInAt: signIns.get(p.id) ?? null,
    surveys: surveyCounts.get(p.id) ?? 0,
    ai24h: aiCounts.get(p.id) ?? 0,
    suspended: Boolean(p.suspended_at),
  }));
}

// 한도 사용량(R-13): 최근 24시간 합계 / 한도, 사용자별 순위(AI+메일 많은 순)
export async function usageSummary(db: SupabaseClient, now = Date.now()) {
  const usage = await recentUsage(db, now);
  const limits = readLimits();
  const ids = [...new Set(usage.map((u) => u.user_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email").in("id", ids).throwOnError() : { data: [] };
  const emails = new Map((profiles ?? []).map((p) => [p.id, p.email as string]));
  const ai = countBy(usage.filter((u) => u.kind === "ai"), (u) => u.user_id);
  const mail = countBy(usage.filter((u) => u.kind === "mail"), (u) => u.user_id);
  const ranking = ids
    .map((id) => ({ userId: id, email: emails.get(id) ?? "(탈퇴한 사용자)", ai: ai.get(id) ?? 0, mail: mail.get(id) ?? 0 }))
    .sort((a, b) => b.ai + b.mail - (a.ai + a.mail));
  return {
    ai: { used: usage.filter((u) => u.kind === "ai").length, limit: limits.geminiRpd },
    mail: { used: usage.filter((u) => u.kind === "mail").length, limit: limits.mailDaily },
    ranking,
    unattributed: usage.filter((u) => !u.user_id).length, // 사용자를 남기기 전 기록, 탈퇴한 사용자의 기록
  };
}
