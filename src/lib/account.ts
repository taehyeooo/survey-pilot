import type { SupabaseClient } from "@supabase/supabase-js";
import { isProtected } from "@/lib/moderation";

// 탈퇴(multi-user R-7): 미리보기 → 확인 글자 → 즉시 삭제 → 감사 기록(ADR 0012, ADR 0020).
// Auth 사용자를 지우면 profiles → surveys → 그 아래 전부가 cascade로 지워지고, usage_events.user_id·survey_id는 비워진다.
// db는 서버(service role) 클라이언트 — Auth 사용자 삭제에 필요하다.

export const LEAVE_WORD = "탈퇴합니다";

export async function previewLeave(db: SupabaseClient, userId: string, adminEmail: string | undefined) {
  const { data: profile } = await db.from("profiles").select("email").eq("id", userId).maybeSingle().throwOnError();
  if (!profile) return null;
  const { data: surveys } = await db.from("surveys").select("id, responses(count)").eq("owner_id", userId).throwOnError();
  return {
    surveys: surveys?.length ?? 0,
    responses: (surveys ?? []).reduce((sum, s) => sum + ((s.responses as { count: number }[])[0]?.count ?? 0), 0),
    protected: await isProtected(db, profile.email, adminEmail),
  };
}

export async function leaveAccount(db: SupabaseClient, input: { userId: string; confirm: string; adminEmail: string | undefined }) {
  if (input.confirm.trim() !== LEAVE_WORD) throw new RangeError(`확인 글자로 "${LEAVE_WORD}"를 적어 주세요.`);
  const preview = await previewLeave(db, input.userId, input.adminEmail);
  if (!preview) throw new RangeError("계정을 찾을 수 없어요.");
  if (preview.protected) throw new RangeError("운영자 계정은 탈퇴할 수 없어요.");
  // 기록을 먼저 남긴다 — 지운 뒤 기록에 실패해 흔적 없이 사라지는 일이 없게. 이메일 대신 내부 번호만.
  await db
    .from("audit_logs")
    .insert({ actor_email: "self", action: "leave", reason: "본인 탈퇴", detail: { user_id: input.userId, surveys: preview.surveys, responses: preview.responses } })
    .throwOnError();
  const { error } = await db.auth.admin.deleteUser(input.userId);
  if (error) throw error;
}
