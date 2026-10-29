import type { SupabaseClient } from "@supabase/supabase-js";
import { emailHashOf } from "@/lib/respond";

// 응답 삭제 요청(R-26). 데이터를 지우는 관리자 동작 — 미리보기 → 사유 → 재확인 → 실행, 감사 기록(ADR 0012).
// 이메일은 해시로 찾는다 — 마감 30일 뒤 원문이 지워져도 찾을 수 있다(ADR 0017). 감사 기록에도 해시만.
// db는 서버(service role) 클라이언트 — 부르는 쪽이 관리자 세션으로 설문 소유를 먼저 확인한다(ADR 0019).

export async function findRespondent(db: SupabaseClient, secret: string, surveyId: string, email: string) {
  const { data } = await db
    .from("respondents")
    .select("id, email_hash, responses(submitted_at, answers(id))")
    .eq("survey_id", surveyId)
    .eq("email_hash", emailHashOf(secret, email))
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  const response = (Array.isArray(data.responses) ? data.responses[0] : data.responses) as { submitted_at: string; answers: unknown[] } | undefined;
  if (!response) return null; // 인증만 하고 내지 않은 사람은 지울 응답이 없다
  return { id: data.id as string, emailHash: data.email_hash as string, submittedAt: response.submitted_at, answers: response.answers?.length ?? 0 };
}

export async function deleteRespondent(
  db: SupabaseClient,
  input: { surveyId: string; respondentId: string; reason: string; actorEmail: string },
) {
  const reason = input.reason.trim();
  if (!reason) throw new RangeError("삭제 사유를 적어 주세요.");
  const { data: target } = await db
    .from("respondents")
    .select("id, email_hash")
    .eq("id", input.respondentId)
    .eq("survey_id", input.surveyId)
    .maybeSingle()
    .throwOnError();
  if (!target) throw new RangeError("지울 응답을 찾을 수 없어요.");
  // 기록을 먼저 남긴다 — 지운 뒤 기록에 실패해 흔적 없이 사라지는 일이 없게
  await db
    .from("audit_logs")
    .insert({ actor_email: input.actorEmail, action: "delete_response", survey_id: input.surveyId, reason, detail: { email_hash: target.email_hash } })
    .throwOnError();
  // 응답자 행을 지우면 응답·답이 함께 지워진다(on delete cascade)
  await db.from("respondents").delete().eq("id", target.id).throwOnError();
}
