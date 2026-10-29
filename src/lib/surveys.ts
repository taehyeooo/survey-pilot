import type { SupabaseClient } from "@supabase/supabase-js";

// 관리자 설문 목록·보관. 관리자 세션 클라이언트(RLS)로 부른다 — 남의 설문은 보이지도 바뀌지도 않는다(ADR 0019).

export type Tab = "designing" | "active" | "closed" | "archived";
export const TABS: { key: Tab; label: string }[] = [
  { key: "designing", label: "설계 중" },
  { key: "active", label: "진행 중" },
  { key: "closed", label: "마감" },
  { key: "archived", label: "보관함" },
];

export function tabOf(s: { status: string; archived_at: string | null }): Tab {
  if (s.archived_at) return "archived";
  if (s.status === "published") return "active";
  if (s.status === "closed") return "closed";
  return "designing";
}

export function groupByTab<T extends { status: string; archived_at: string | null }>(rows: T[]) {
  const groups: Record<Tab, T[]> = { designing: [], active: [], closed: [], archived: [] };
  for (const row of rows) groups[tabOf(row)].push(row);
  return groups;
}

export interface SurveyListItem {
  id: string;
  problem: string;
  purpose: string | null;
  status: string;
  archived_at: string | null;
  target_responses: number | null;
  created_at: string;
  responseCount: number;
}

export async function listSurveys(db: SupabaseClient): Promise<SurveyListItem[]> {
  const { data } = await db
    .from("surveys")
    .select("id, problem, purpose, status, archived_at, target_responses, created_at, responses(count)")
    .order("created_at", { ascending: false })
    .throwOnError();
  return (data ?? []).map(({ responses, ...s }) => ({ ...s, responseCount: responses?.[0]?.count ?? 0 }));
}

const NOT_FOUND = "설문을 찾을 수 없어요";

// 진행 중이면 먼저 마감하고 보관한다(R-5, spec 가정 2).
export async function archiveSurvey(db: SupabaseClient, id: string, now = new Date()) {
  const { data: survey } = await db.from("surveys").select("status").eq("id", id).maybeSingle().throwOnError();
  if (!survey) throw new Error(NOT_FOUND);
  const at = now.toISOString();
  const patch =
    survey.status === "published"
      ? { status: "closed", closed_at: at, close_reason: "archive", archived_at: at }
      : { archived_at: at };
  const { data } = await db.from("surveys").update(patch).eq("id", id).select("id").throwOnError();
  if (!data?.length) throw new Error(NOT_FOUND);
}

// 보관 전 상태로 — 마감된 설문은 마감 그대로.
export async function restoreSurvey(db: SupabaseClient, id: string) {
  const { data } = await db.from("surveys").update({ archived_at: null }).eq("id", id).select("id").throwOnError();
  if (!data?.length) throw new Error(NOT_FOUND);
}
