"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { requireMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveSurvey, restoreSurvey } from "@/lib/surveys";

export async function archive(id: string) {
  const { user } = await requireMember();
  await archiveSurvey(createAdminClient(), user.id, id);
  revalidatePath("/app");
}

export async function restore(id: string) {
  const { user } = await requireMember();
  await restoreSurvey(createAdminClient(), user.id, id);
  revalidatePath("/app");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
