import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail, normalizeEmail } from "@/lib/admin";

// 운영 조치(multi-user R-12, R-14): 미리보기 → 사유 → 실행 → 감사 기록(ADR 0012).
// 미리보기는 아무것도 바꾸지 않고, 실행은 같은 검사를 다시 한다. 감사 기록은 실행 전에 남긴다 —
// 바꾼 뒤 기록에 실패해 흔적 없이 바뀌는 일이 없게(deletion.ts와 같은 순서). 개인정보 대신 내부 번호만.
// db는 서버(service role) 클라이언트 — 부르는 쪽이 requireOperator로 운영자를 먼저 확인한다.

function reasonOf(raw: string) {
  const reason = raw.trim();
  if (!reason) throw new RangeError("사유를 적어 주세요.");
  return reason;
}

async function audit(db: SupabaseClient, row: { actorEmail: string; action: string; reason: string; surveyId?: string; detail?: Record<string, string> }) {
  await db
    .from("audit_logs")
    .insert({ actor_email: row.actorEmail, action: row.action, reason: row.reason, survey_id: row.surveyId ?? null, detail: row.detail ?? {} })
    .throwOnError();
}

// ── 정지·해제(R-12) ─────────────────────────────────────────

// 운영자 계정은 정지할 수 없다(자신 포함, ADR 0020) — ADMIN_EMAIL이거나 admins 표에 있으면.
async function isProtected(db: SupabaseClient, email: string, adminEmail: string | undefined) {
  if (isAdminEmail(email, adminEmail)) return true;
  const { data } = await db.from("admins").select("email").eq("email", normalizeEmail(email)).maybeSingle().throwOnError();
  return Boolean(data);
}

export async function previewSuspension(db: SupabaseClient, userId: string, adminEmail: string | undefined) {
  const { data: profile } = await db.from("profiles").select("email, suspended_at").eq("id", userId).maybeSingle().throwOnError();
  if (!profile) return null;
  // 닫힐 응답 링크: 진행 중이고 보관·내리기 전인 설문
  const { count } = await db
    .from("surveys")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("status", "published")
    .is("archived_at", null)
    .is("taken_down_at", null)
    .throwOnError();
  return {
    email: profile.email as string,
    suspended: Boolean(profile.suspended_at),
    openLinks: count ?? 0,
    protected: await isProtected(db, profile.email, adminEmail),
  };
}

export async function setSuspension(
  db: SupabaseClient,
  input: { userId: string; suspend: boolean; reason: string; actorEmail: string; adminEmail: string | undefined },
) {
  const reason = reasonOf(input.reason);
  const preview = await previewSuspension(db, input.userId, input.adminEmail);
  if (!preview) throw new RangeError("사용자를 찾을 수 없어요.");
  if (input.suspend && preview.protected) throw new RangeError("운영자 계정은 정지할 수 없어요.");
  await audit(db, { actorEmail: input.actorEmail, action: input.suspend ? "suspend_user" : "unsuspend_user", reason, detail: { user_id: input.userId } });
  await db
    .from("profiles")
    .update(input.suspend ? { suspended_at: new Date().toISOString(), suspend_reason: reason } : { suspended_at: null, suspend_reason: null })
    .eq("id", input.userId)
    .throwOnError();
}

// ── 전체 설문과 내리기·되돌리기(R-14) ─────────────────────────────

export interface OpsSurvey {
  id: string;
  problem: string;
  ownerEmail: string;
  status: string;
  responses: number;
  takenDown: boolean;
}

// 목록·숫자만 고른다 — 문항·답·리포트는 고르지도 않는다(ADR 0020).
export const OPS_COLUMNS = "id, problem, status, taken_down_at, owner:profiles(email), responses(count)";

function toOpsSurvey(row: Record<string, unknown>): OpsSurvey {
  const owner = row.owner as { email: string } | null;
  const responses = row.responses as { count: number }[] | null;
  return {
    id: row.id as string,
    problem: row.problem as string,
    ownerEmail: owner?.email ?? "",
    status: row.status as string,
    responses: responses?.[0]?.count ?? 0,
    takenDown: Boolean(row.taken_down_at),
  };
}

export async function listAllSurveys(db: SupabaseClient): Promise<OpsSurvey[]> {
  const { data } = await db.from("surveys").select(OPS_COLUMNS).order("created_at", { ascending: false }).throwOnError();
  return (data ?? []).map(toOpsSurvey);
}

export async function previewTakedown(db: SupabaseClient, surveyId: string) {
  const { data } = await db.from("surveys").select(OPS_COLUMNS).eq("id", surveyId).maybeSingle().throwOnError();
  return data ? toOpsSurvey(data) : null;
}

export async function setTakedown(db: SupabaseClient, input: { surveyId: string; takeDown: boolean; reason: string; actorEmail: string }) {
  const reason = reasonOf(input.reason);
  if (!(await previewTakedown(db, input.surveyId))) throw new RangeError("설문을 찾을 수 없어요.");
  await audit(db, { actorEmail: input.actorEmail, action: input.takeDown ? "take_down_survey" : "restore_survey", reason, surveyId: input.surveyId });
  await db
    .from("surveys")
    .update(input.takeDown ? { taken_down_at: new Date().toISOString(), takedown_reason: reason } : { taken_down_at: null, takedown_reason: null })
    .eq("id", input.surveyId)
    .throwOnError();
}
