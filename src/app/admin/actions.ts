"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveSurvey, restoreSurvey } from "@/lib/surveys";

export async function archive(id: string) {
  const { user } = await requireAdmin();
  await archiveSurvey(createAdminClient(), user.id, id);
  revalidatePath("/admin");
}

export async function restore(id: string) {
  const { user } = await requireAdmin();
  await restoreSurvey(createAdminClient(), user.id, id);
  revalidatePath("/admin");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
