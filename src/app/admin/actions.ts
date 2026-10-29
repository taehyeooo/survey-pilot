"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { requireAdmin } from "@/lib/auth";
import { archiveSurvey, restoreSurvey } from "@/lib/surveys";

export async function archive(id: string) {
  const { db } = await requireAdmin();
  await archiveSurvey(db, id);
  revalidatePath("/admin");
}

export async function restore(id: string) {
  const { db } = await requireAdmin();
  await restoreSurvey(db, id);
  revalidatePath("/admin");
}

export async function logout() {
  await signOut();
  redirect("/login");
}
