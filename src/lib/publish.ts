import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError } from "@/lib/design";
import { isClosing } from "@/lib/questions";

// 게시(R-13)·공개 링크(R-14)·공유 문구(R-15). db는 서버(service role) 클라이언트 —
// 관리자 쪽은 부르는 쪽이 세션으로 소유를 먼저 확인하고, 공개 쪽은 slug로만 찾는다(ADR 0019).

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// 12자 영문·숫자(62^12 ≈ 3×10^21) — 추측하기 어렵다. 248 이상 바이트는 버려 치우침을 없앤다.
export function makeSlug(length = 12) {
  let slug = "";
  while (slug.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < 248 && slug.length < length) slug += ALPHABET[byte % 62];
    }
  }
  return slug;
}

// 공유 메시지 + 링크. 소요 시간이 문구에 없으면 덧붙인다(R-15).
export function buildShareText(message: string, link: string, minutes: number) {
  let text = message.trim() || "설문에 참여해 주세요.";
  if (!text.includes(`${minutes}분`)) text += ` (약 ${minutes}분)`;
  return `${text}\n${link}`;
}

export async function publishSurvey(db: SupabaseClient, survey: { id: string; status: string }) {
  if (survey.status !== "reviewing") throw new ConflictError("설계를 확인하고 문항을 만든 뒤에 게시할 수 있어요.");
  const { data: questions } = await db.from("questions").select("type, prompt").eq("survey_id", survey.id).throwOnError();
  if (!questions?.some((q) => !isClosing(q))) throw new ConflictError("게시하려면 문항이 하나 이상 있어야 해요.");
  const slug = makeSlug();
  await db.from("surveys").update({ status: "published", slug }).eq("id", survey.id).eq("status", "reviewing").throwOnError();
  return slug;
}

// 공개 링크로 찾는다 — 게시 전(designing·reviewing)이면 없는 것과 같다(R-13).
// paused: 설문 주인이 정지됐으면 응답을 받지 않는다(multi-user R-8). 해제되면 다시 false.
export async function findPublicSurvey(db: SupabaseClient, slug: string) {
  if (!/^[A-Za-z0-9]{12}$/.test(slug)) return null;
  const { data } = await db
    .from("surveys")
    .select("id, status, intro, target_minutes, closes_at, archived_at, owner:profiles(suspended_at), questions(id, position, type, prompt, options, required)")
    .order("position", { referencedTable: "questions" })
    .eq("slug", slug)
    .in("status", ["published", "closed"])
    .maybeSingle()
    .throwOnError();
  if (!data) return null;
  const { owner, ...survey } = data as typeof data & { owner: { suspended_at: string | null } | null };
  return { ...survey, paused: Boolean(owner?.suspended_at) };
}

export async function responseCount(db: SupabaseClient, surveyId: string) {
  const { count } = await db.from("responses").select("id", { count: "exact", head: true }).eq("survey_id", surveyId).throwOnError();
  return count ?? 0;
}

// 문항은 게시 전, 또는 게시 후 응답이 0건일 때만 고친다(R-14). DB 트리거가 한 번 더 막는다.
export async function canEditQuestions(db: SupabaseClient, survey: { id: string; status: string }) {
  if (survey.status === "reviewing") return true;
  if (survey.status !== "published") return false;
  return (await responseCount(db, survey.id)) === 0;
}

// 응답이 있어도 고칠 수 있는 칸: 소개글·공유 메시지·마감일·목표 응답 수(R-14, R-15).
export async function updateSettings(
  db: SupabaseClient,
  survey: { id: string; status: string },
  edit: { intro: string; share_message: string; closesAt: Date; targetResponses: number },
) {
  if (survey.status !== "reviewing" && survey.status !== "published") throw new ConflictError("마감된 설문은 고칠 수 없어요.");
  const intro = edit.intro.trim();
  if (!intro) throw new RangeError("소개글을 비워 둘 수 없어요.");
  if (Number.isNaN(edit.closesAt.getTime()) || edit.closesAt.getTime() <= Date.now()) throw new RangeError("마감일은 지금 이후여야 해요.");
  if (!Number.isInteger(edit.targetResponses) || edit.targetResponses < 1) throw new RangeError("목표 응답 수는 1 이상이어야 해요.");
  await db
    .from("surveys")
    .update({ intro, share_message: edit.share_message.trim(), closes_at: edit.closesAt.toISOString(), target_responses: edit.targetResponses })
    .eq("id", survey.id)
    .throwOnError();
}
