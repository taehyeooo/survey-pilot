"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { finalReportQuietly } from "@/lib/report-runtime";
import { notFound, redirect } from "next/navigation";
import { getAi } from "@/lib/ai-runtime";
import { requireMember } from "@/lib/auth";
import { ownedSurvey } from "@/lib/members";
import {
  aiErrorMessage,
  answerClarifications,
  ConflictError,
  confirmDesign,
  createSurvey,
  runClarify,
  runDesign,
  updateDesign,
  validateProblem,
  type SurveyRow,
} from "@/lib/design";
import {
  addQuestion,
  deleteQuestion,
  generateQuestions,
  moveQuestion,
  regenerateQuestion,
  updateQuestion,
  type QuestionSurvey,
} from "@/lib/questions";
import { canEditQuestions, publishSurvey, setRequireEmail, updateSettings } from "@/lib/publish";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteOwnRespondent, findRespondent } from "@/lib/deletion";
import { hashSecret } from "@/lib/mailer-runtime";
import { generateReport } from "@/lib/report";
import { closeSurvey } from "@/lib/submit";

// 주인 확인은 세션(RLS)과 쿼리 조건 두 곳에서, 쓰기는 서버 클라이언트로(multi-user R-3, ADR 0019 v2).
async function loadOwned(id: string) {
  const { db, user } = await requireMember();
  const data = await ownedSurvey<SurveyRow & QuestionSurvey>(db, user.id, id, "id, status, problem, clarifications, purpose, closes_at, audience, target_minutes");
  if (!data) notFound();
  return data;
}

function messageOf(error: unknown) {
  if (error instanceof RangeError || error instanceof ConflictError) return error.message;
  // DB 트리거(R-14)가 막은 경우 — 화면 확인과 쓰기 사이에 응답이 들어왔을 때
  if (error instanceof Error && /응답이 있는 설문/.test(error.message)) return "응답이 들어온 설문은 문항을 바꿀 수 없어요.";
  console.error(error);
  return aiErrorMessage(error);
}

// 성공하면 ?moved=1 — 화면이 방금 끝난 단계 칸을 채우는 움직임을 보인다. 실패하면 ?error=.
function back(id: string, error?: string): never {
  redirect(`/app/surveys/${id}?${error ? `error=${encodeURIComponent(error)}` : "moved=1"}`);
}

export type StartState = { error?: string; problem?: string };

// 문제 입력(R-6) → 되묻기(R-7) → 빠진 게 없으면 바로 설계(R-8)
export async function startSurvey(_prev: StartState, formData: FormData): Promise<StartState> {
  const { user } = await requireMember();
  const text = String(formData.get("problem") ?? "");
  let id: string;
  try {
    validateProblem(text);
    id = await createSurvey(createAdminClient(), user.id, text);
  } catch (error) {
    return { error: messageOf(error), problem: text };
  }

  let error: string | undefined;
  try {
    const db = createAdminClient();
    const survey = await loadOwned(id);
    const questions = await runClarify(db, getAi("clarify", id), survey);
    if (questions.length === 0) await runDesign(db, getAi("design", id), await loadOwned(id));
  } catch (e) {
    error = messageOf(e); // 설문은 남는다 — 그 화면에서 다시 시도(R-28)
  }
  back(id, error);
}

export async function answerAndDesign(id: string, formData: FormData) {
  const survey = await loadOwned(id);
  const answers = survey.clarifications.map((_, i) => {
    const picked = String(formData.get(`answer-${i}`) ?? "");
    return picked === "__other" ? String(formData.get(`other-${i}`) ?? "") : picked;
  });
  let error: string | undefined;
  try {
    const db = createAdminClient();
    await answerClarifications(db, survey, answers);
    await runDesign(db, getAi("design", id), await loadOwned(id));
  } catch (e) {
    error = messageOf(e);
  }
  back(id, error);
}

export async function regenerateDesign(id: string) {
  const survey = await loadOwned(id);
  let error: string | undefined;
  try {
    await runDesign(createAdminClient(), getAi("design", id), survey);
  } catch (e) {
    error = messageOf(e);
  }
  back(id, error);
}

// 확인 ①(R-9): 고친 내용을 저장하고 검토 단계로
export async function saveAndConfirm(id: string, formData: FormData) {
  const survey = await loadOwned(id);
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  let error: string | undefined;
  try {
    const db = createAdminClient();
    await updateDesign(
      db,
      survey,
      {
        purpose: text("purpose"),
        audience: text("audience"),
        hypotheses: formData.getAll("hypothesis").map(String).map((h) => h.trim()).filter(Boolean),
        target_responses: Number(text("target_responses")),
        target_minutes: Number(text("target_minutes")),
        intro: text("intro"),
        share_message: text("share_message"),
      },
      new Date(`${text("closes_at")}:00+09:00`), // 입력은 KST
    );
    await confirmDesign(db, await loadOwned(id));
  } catch (e) {
    error = e instanceof Error && e.name === "ZodError" ? "빈 칸이 없는지, 가설이 2~4개인지 확인해 주세요." : messageOf(e);
  }
  back(id, error);
}

// ── 문항(R-10~R-13) — 게시 전, 또는 게시 후 응답 0건일 때만(R-14) ─────────────
async function loadEditable(id: string) {
  const survey = await loadOwned(id);
  if (!(await canEditQuestions(createAdminClient(), survey))) {
    throw new ConflictError(survey.status === "published" ? "응답이 들어온 설문은 문항을 바꿀 수 없어요." : "설계를 확인한 설문에서만 문항을 바꿀 수 있어요.");
  }
  return survey;
}

async function questionStep(id: string, step: (survey: QuestionSurvey) => Promise<void>) {
  let error: string | undefined;
  try {
    await step(await loadEditable(id));
  } catch (e) {
    error = messageOf(e);
  }
  // 성공하면 같은 화면을 새로 그린다. 같은 주소에 #만 바꿔 이동하면 라우터가 데이터를 다시 가져오지 않는다.
  if (error) redirect(`/app/surveys/${id}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/app/surveys/${id}`);
}

export async function makeQuestions(id: string) {
  await questionStep(id, (s) => generateQuestions(createAdminClient(), getAi("questions", id), s));
}

export async function saveQuestion(id: string, questionId: string, formData: FormData) {
  await questionStep(id, () =>
    updateQuestion(createAdminClient(), id, questionId, {
      prompt: String(formData.get("prompt") ?? ""),
      options: String(formData.get("options") ?? "").split(/\r?\n/),
      required: formData.get("required") === "on",
      type: String(formData.get("type") ?? ""),
    }),
  );
}

export async function moveUp(id: string, questionId: string) {
  await questionStep(id, () => moveQuestion(createAdminClient(), id, questionId, -1));
}

export async function moveDown(id: string, questionId: string) {
  await questionStep(id, () => moveQuestion(createAdminClient(), id, questionId, 1));
}

export async function appendQuestion(id: string) {
  await questionStep(id, () => addQuestion(createAdminClient(), id));
}

export async function removeQuestion(id: string, questionId: string) {
  await questionStep(id, () => deleteQuestion(createAdminClient(), id, questionId));
}

export async function remakeQuestion(id: string, questionId: string) {
  await questionStep(id, (s) => regenerateQuestion(createAdminClient(), getAi("question", id), s, questionId));
}

// ── 게시(R-13)·설정(R-14, R-15) ─────────────────────────────────────────
export async function publish(id: string) {
  const survey = await loadOwned(id);
  let error: string | undefined;
  try {
    await publishSurvey(createAdminClient(), survey);
  } catch (e) {
    error = messageOf(e);
  }
  back(id, error);
}

export async function saveSettings(id: string, formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  let error: string | undefined;
  try {
    await updateSettings(createAdminClient(), await loadOwned(id), {
      intro: text("intro"),
      share_message: text("share_message"),
      closesAt: new Date(`${text("closes_at")}:00+09:00`), // 입력은 KST
      targetResponses: Number(text("target_responses")),
    });
  } catch (e) {
    error = messageOf(e);
  }
  if (error) redirect(`/app/surveys/${id}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/app/surveys/${id}`);
}

// 응답 방식(ADR 0017 v2) — 한 사람 한 번만(이메일 인증) 켜기·끄기
export async function saveResponseMode(id: string, formData: FormData) {
  let error: string | undefined;
  try {
    await setRequireEmail(createAdminClient(), await loadOwned(id), formData.get("require_email") === "on");
  } catch (e) {
    error = messageOf(e);
  }
  if (error) redirect(`/app/surveys/${id}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/app/surveys/${id}`);
}

// 수동 마감(R-16)
export async function closeNow(id: string) {
  const survey = await loadOwned(id);
  let error: string | undefined;
  try {
    await closeSurvey(createAdminClient(), survey);
    after(() => finalReportQuietly(id)); // 마감 뒤 최종 리포트는 응답을 돌려준 뒤 만든다
  } catch (e) {
    error = messageOf(e);
  }
  back(id, error);
}

// 리포트(R-24): 진행 중이면 중간, 마감 뒤면 최종. 같은 응답 수면 저장된 것을 쓴다.
export async function makeReport(id: string) {
  const survey = await loadOwned(id);
  let error: string | undefined;
  try {
    if (survey.status !== "published" && survey.status !== "closed") throw new ConflictError("게시한 설문에서만 리포트를 만들 수 있어요.");
    await generateReport(createAdminClient(), getAi("report", id), id, survey.status === "closed" ? "final" : "interim");
  } catch (e) {
    error = messageOf(e);
  }
  if (error) redirect(`/app/surveys/${id}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/app/surveys/${id}`);
}

// ── 응답 삭제 요청(R-26, ADR 0012): 미리보기 → 사유 → 재확인 → 삭제 + 감사 기록 ──────────────
export type DeletionState = {
  step: "search" | "confirm" | "done";
  email?: string;
  preview?: { respondentId: string; submittedAt: string; answers: number };
  error?: string;
};

export async function findForDeletion(id: string, _prev: DeletionState, formData: FormData): Promise<DeletionState> {
  await loadOwned(id);
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { step: "search", error: "응답자 이메일을 적어 주세요." };
  const found = await findRespondent(createAdminClient(), hashSecret(), id, email);
  if (!found) return { step: "search", email, error: "이 이메일로 낸 응답이 없어요." };
  return { step: "confirm", email, preview: { respondentId: found.id, submittedAt: found.submittedAt, answers: found.answers } };
}

export async function deleteForRequest(id: string, respondentId: string, _prev: DeletionState, formData: FormData): Promise<DeletionState> {
  const { user } = await requireMember();
  await loadOwned(id);
  if (formData.get("confirm") !== "on") return { step: "confirm", error: "되돌릴 수 없다는 것을 확인해 주세요." };
  try {
    await deleteOwnRespondent(createAdminClient(), user.id, { surveyId: id, respondentId, reason: String(formData.get("reason") ?? ""), actorEmail: user.email ?? "" });
  } catch (e) {
    return { step: "confirm", error: messageOf(e) };
  }
  revalidatePath(`/app/surveys/${id}`);
  return { step: "done" };
}
