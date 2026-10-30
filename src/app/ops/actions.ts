"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { deleteResponsesByEmail, findResponsesByEmail } from "@/lib/deletion";
import { hashSecret } from "@/lib/mailer-runtime";
import { setSuspension, setTakedown } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";

// 운영 조치(multi-user R-12, R-14). 함수마다 운영자 확인을 먼저 부른다(test/ops-guard.test.ts).
// 사유와 "확인했어요" 체크를 받고 실행한다 — 응답 삭제 요청과 같은 틀(ADR 0012).

function messageOf(error: unknown) {
  if (error instanceof RangeError) return error.message;
  console.error(error);
  return "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

async function run(path: string, formData: FormData, act: (reason: string) => Promise<void>): Promise<never> {
  let error: string | undefined;
  try {
    if (formData.get("confirm") !== "on") throw new RangeError("내용을 확인했다고 체크해 주세요.");
    await act(String(formData.get("reason") ?? ""));
  } catch (e) {
    error = messageOf(e);
  }
  revalidatePath("/ops", "layout");
  redirect(`${path}?${error ? `error=${encodeURIComponent(error)}` : "done=1"}`);
}

export async function suspendUser(userId: string, formData: FormData) {
  const { user } = await requireOperator();
  await run(`/ops/users/${userId}`, formData, (reason) =>
    setSuspension(createAdminClient(), { userId, suspend: true, reason, actorEmail: user.email ?? "", adminEmail: process.env.ADMIN_EMAIL }),
  );
}

export async function unsuspendUser(userId: string, formData: FormData) {
  const { user } = await requireOperator();
  await run(`/ops/users/${userId}`, formData, (reason) =>
    setSuspension(createAdminClient(), { userId, suspend: false, reason, actorEmail: user.email ?? "", adminEmail: process.env.ADMIN_EMAIL }),
  );
}

export async function takeDownSurvey(surveyId: string, formData: FormData) {
  const { user } = await requireOperator();
  await run(`/ops/surveys/${surveyId}`, formData, (reason) =>
    setTakedown(createAdminClient(), { surveyId, takeDown: true, reason, actorEmail: user.email ?? "" }),
  );
}

export async function restoreTakenDown(surveyId: string, formData: FormData) {
  const { user } = await requireOperator();
  await run(`/ops/surveys/${surveyId}`, formData, (reason) =>
    setTakedown(createAdminClient(), { surveyId, takeDown: false, reason, actorEmail: user.email ?? "" }),
  );
}

// ── 응답 삭제 요청(multi-user R-15): 이메일로 찾기 → 제목·건수 미리보기 → 사유·확인 → 삭제 ──────────
// 이메일은 URL에 넣지 않는다 — 폼 상태로만 오간다.
export type OpsDeletionState = {
  step: "search" | "confirm" | "done";
  email?: string;
  surveys?: string[]; // 응답한 설문 제목
  deleted?: number;
  error?: string;
};

export async function findOpsDeletion(_prev: OpsDeletionState, formData: FormData): Promise<OpsDeletionState> {
  await requireOperator();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { step: "search", error: "응답자 이메일을 적어 주세요." };
  const found = await findResponsesByEmail(createAdminClient(), hashSecret(), email);
  if (found.length === 0) return { step: "search", email, error: "이 이메일로 낸 응답이 없어요." };
  return { step: "confirm", email, surveys: found.map((f) => f.problem) };
}

export async function deleteOpsDeletion(prev: OpsDeletionState, formData: FormData): Promise<OpsDeletionState> {
  const { user } = await requireOperator();
  if (formData.get("confirm") !== "on") return { ...prev, error: "되돌릴 수 없다는 것을 확인해 주세요." };
  try {
    const deleted = await deleteResponsesByEmail(createAdminClient(), hashSecret(), {
      email: prev.email ?? "",
      expected: prev.surveys?.length ?? 0,
      reason: String(formData.get("reason") ?? ""),
      actorEmail: user.email ?? "",
    });
    revalidatePath("/ops", "layout");
    return { step: "done", deleted };
  } catch (e) {
    return { ...prev, error: messageOf(e) };
  }
}
