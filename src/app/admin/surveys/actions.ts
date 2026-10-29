"use server";

import { notFound, redirect } from "next/navigation";
import { getAi } from "@/lib/ai-runtime";
import { requireAdmin } from "@/lib/auth";
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
import { createAdminClient } from "@/lib/supabase/admin";

// 소유 확인은 관리자 세션(RLS)으로, 쓰기는 서버 클라이언트로(ADR 0019).
async function loadOwned(id: string) {
  const { db } = await requireAdmin();
  const { data } = await db
    .from("surveys")
    .select("id, status, problem, clarifications, purpose, closes_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  return data as SurveyRow;
}

function messageOf(error: unknown) {
  if (error instanceof RangeError || error instanceof ConflictError) return error.message;
  console.error(error);
  return aiErrorMessage(error);
}

function back(id: string, error?: string): never {
  redirect(`/admin/surveys/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export type StartState = { error?: string; problem?: string };

// 문제 입력(R-6) → 되묻기(R-7) → 빠진 게 없으면 바로 설계(R-8)
export async function startSurvey(_prev: StartState, formData: FormData): Promise<StartState> {
  const { user } = await requireAdmin();
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
    const questions = await runClarify(db, getAi("clarify"), survey);
    if (questions.length === 0) await runDesign(db, getAi("design"), await loadOwned(id));
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
    await runDesign(db, getAi("design"), await loadOwned(id));
  } catch (e) {
    error = messageOf(e);
  }
  back(id, error);
}

export async function regenerateDesign(id: string) {
  const survey = await loadOwned(id);
  let error: string | undefined;
  try {
    await runDesign(createAdminClient(), getAi("design"), survey);
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
