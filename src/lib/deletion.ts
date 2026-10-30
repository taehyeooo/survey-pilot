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

// 설문 주인의 삭제(multi-user R-16): 자기 설문에서만. 화면이 먼저 확인하지만 여기서 한 번 더 막는다.
export async function deleteOwnRespondent(
  db: SupabaseClient,
  ownerId: string,
  input: { surveyId: string; respondentId: string; reason: string; actorEmail: string },
) {
  const { data } = await db.from("surveys").select("id").eq("id", input.surveyId).eq("owner_id", ownerId).maybeSingle().throwOnError();
  if (!data) throw new RangeError("지울 응답을 찾을 수 없어요.");
  await deleteRespondent(db, input);
}

// 운영자의 삭제(multi-user R-15): 모든 사용자의 설문에서 이메일 해시로 찾는다. 운영자는 설문 제목과 건수만 본다 —
// 제출 시각·답은 고르지 않는다(ADR 0020). 제출하지 않은(인증만 한) 사람은 지울 응답이 없다.
export async function findResponsesByEmail(db: SupabaseClient, secret: string, email: string) {
  const { data } = await db
    .from("respondents")
    .select("id, survey_id, surveys(problem), responses!inner(id)")
    .eq("email_hash", emailHashOf(secret, email))
    .throwOnError();
  return (data ?? []).map((r) => ({
    respondentId: r.id as string,
    surveyId: r.survey_id as string,
    problem: (r.surveys as unknown as { problem: string } | null)?.problem ?? "",
  }));
}

// 미리보기에서 본 건수와 다르면(그 사이 응답이 들어오거나 지워짐) 지우지 않고 다시 찾게 한다.
export async function deleteResponsesByEmail(db: SupabaseClient, secret: string, input: { email: string; expected: number; reason: string; actorEmail: string }) {
  const found = await findResponsesByEmail(db, secret, input.email);
  if (found.length === 0) throw new RangeError("이 이메일로 낸 응답이 없어요.");
  if (found.length !== input.expected) throw new RangeError("그 사이 응답이 바뀌었어요. 다시 찾아 주세요.");
  // 설문마다 deleteRespondent — 사유를 확인하고(없으면 첫 건에서 막혀 아무것도 지우지 않음), 감사 기록이 설문마다 1행씩 남는다
  for (const f of found) await deleteRespondent(db, { surveyId: f.surveyId, respondentId: f.respondentId, reason: input.reason, actorEmail: input.actorEmail });
  return found.length;
}
