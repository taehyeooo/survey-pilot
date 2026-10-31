import { isOtherLabel, OTHER_PREFIX, OTHER_TEXT_MAX } from "@/lib/other";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError } from "@/lib/design";
import { ipHashOf, isClosed, PAUSED, readToken, type OpenSurvey } from "@/lib/respond";

// 응답 제출(R-19)·마감(R-16)·제출 횟수 제한(R-4). 저장은 DB 함수 submit_response가 한 트랜잭션으로 한다.
// db는 서버(service role) 클라이언트(ADR 0019).

export const IP_SUBMIT_LIMIT = 60; // 같은 IP, 1시간 — 동아리방·강의실처럼 한 와이파이에서 여럿이 답할 수 있게 10→60(결정 41)
const HOUR_MS = 60 * 60_000;
const TEXT_MAX = 2000;

export interface SubmitQuestion {
  id: string;
  type: "single" | "multi" | "scale" | "text";
  required: boolean;
  options: { id: string; label: string }[];
}

export type SubmitErrorCode = "token" | "invalid" | "closed" | "done" | "ip";

export class SubmitError extends Error {
  name = "SubmitError";
  constructor(
    message: string,
    readonly code: SubmitErrorCode,
  ) {
    super(message);
  }
}

// 폼 값(문항 id → 값들)을 저장할 값으로. 선택지는 id 배열, 척도는 1~5 정수, 주관식은 글(R-19).
export function validateAnswers(questions: SubmitQuestion[], raw: Record<string, string[]>) {
  const answers: { question_id: string; value: string[] | number | string }[] = [];
  questions.forEach((q, i) => {
    const values = (raw[q.id] ?? []).map((v) => String(v).trim()).filter(Boolean);
    const missing = () => {
      if (q.required) throw new SubmitError(`${i + 1}번 문항에 답해 주세요.`, "invalid");
    };
    if (values.length === 0) return missing();
    if (q.type === "text") {
      if (values[0].length > TEXT_MAX) throw new SubmitError("주관식은 2,000자까지 쓸 수 있어요.", "invalid");
      answers.push({ question_id: q.id, value: values[0] });
    } else if (q.type === "scale") {
      const n = Number(values[0]);
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new SubmitError(`${i + 1}번 문항 값이 올바르지 않아요.`, "invalid");
      answers.push({ question_id: q.id, value: n });
    } else {
      const other = values.find((v) => v.startsWith(OTHER_PREFIX))?.slice(OTHER_PREFIX.length).trim() ?? "";
      const ids = [...new Set(values.filter((v) => !v.startsWith(OTHER_PREFIX)))];
      if (ids.length === 0) return missing();
      if (q.type === "single" && ids.length > 1) throw new SubmitError(`${i + 1}번 문항은 하나만 고를 수 있어요.`, "invalid");
      if (!ids.every((id) => q.options.some((o) => o.id === id))) throw new SubmitError(`${i + 1}번 문항 값이 올바르지 않아요.`, "invalid");
      // 기타를 골랐을 때만 쓴 글을 함께 둔다(결정 41)
      const otherChosen = q.options.some((o) => ids.includes(o.id) && isOtherLabel(o.label));
      if (other && otherChosen && other.length > OTHER_TEXT_MAX) throw new SubmitError(`${i + 1}번 문항 기타 글은 ${OTHER_TEXT_MAX}자까지 쓸 수 있어요.`, "invalid");
      answers.push({ question_id: q.id, value: other && otherChosen ? [...ids, `${OTHER_PREFIX}${other}`] : ids });
    }
  });
  return answers;
}

const CLOSED = "마감된 설문이에요. 참여해 주셔서 고마워요.";

export async function submitResponse(
  db: SupabaseClient,
  secret: string,
  input: { survey: OpenSurvey; token: string; raw: Record<string, string[]>; ip: string },
  now = Date.now(),
) {
  const respondentId = readToken(secret, input.token, now);
  if (!respondentId) throw new SubmitError("인증한 지 30분이 지났어요. 새로고침해서 이메일 인증을 다시 해 주세요.", "token");
  if (isClosed(input.survey, now)) throw new SubmitError(CLOSED, "closed");
  if (input.survey.paused) throw new SubmitError(PAUSED, "closed");

  // 다른 설문에서 받은 토큰으로 내지 못하게
  const { data: respondent } = await db
    .from("respondents")
    .select("id")
    .eq("id", respondentId)
    .eq("survey_id", input.survey.id)
    .maybeSingle()
    .throwOnError();
  if (!respondent) throw new SubmitError("인증 정보가 맞지 않아요. 새로고침해서 다시 인증해 주세요.", "token");

  const ipHash = ipHashOf(secret, input.ip);
  const { count } = await db
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gt("submitted_at", new Date(now - HOUR_MS).toISOString())
    .throwOnError();
  if ((count ?? 0) >= IP_SUBMIT_LIMIT) throw new SubmitError("제출이 많아요. 잠시 후 다시 시도해 주세요.", "ip");

  const { data: questions } = await db
    .from("questions")
    .select("id, type, required, options")
    .eq("survey_id", input.survey.id)
    .order("position")
    .throwOnError();
  const answers = validateAnswers((questions ?? []) as SubmitQuestion[], input.raw);

  const { data: result } = await db
    .rpc("submit_response", { p_survey_id: input.survey.id, p_respondent_id: respondentId, p_ip_hash: ipHash, p_answers: answers })
    .throwOnError();
  if (result === "closed") throw new SubmitError(CLOSED, "closed");
  if (result === "done") throw new SubmitError("이미 응답하셨어요. 참여해 주셔서 고마워요.", "done");
  return "ok" as const;
}

// 마감일이 지난 진행 중 설문을 한꺼번에 마감한다 — 화면에 들어올 때마다, 하루 1회 크론에서도(R-16).
export async function closeOverdue(db: SupabaseClient, now = new Date(), ownerId?: string) {
  let query = db
    .from("surveys")
    .update({ status: "closed", closed_at: now.toISOString(), close_reason: "deadline" })
    .eq("status", "published")
    .lte("closes_at", now.toISOString());
  if (ownerId) query = query.eq("owner_id", ownerId); // 테스트가 다른 설문을 건드리지 않게
  await query.throwOnError();
}

export async function closeSurvey(db: SupabaseClient, survey: { id: string; status: string }) {
  if (survey.status !== "published") throw new ConflictError("진행 중인 설문만 마감할 수 있어요.");
  await db
    .from("surveys")
    .update({ status: "closed", closed_at: new Date().toISOString(), close_reason: "manual" })
    .eq("id", survey.id)
    .eq("status", "published")
    .throwOnError();
}
