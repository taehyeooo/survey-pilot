"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
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
