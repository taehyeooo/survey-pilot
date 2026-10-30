"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth";
import { agreeToTerms } from "@/lib/members";
import { createAdminClient } from "@/lib/supabase/admin";

// 이용 안내 동의(multi-user R-2). profiles 쓰기는 서버만 한다(ADR 0019 v2).
export async function agree() {
  const { user } = await requireSignedIn();
  await agreeToTerms(createAdminClient(), user.id);
  redirect("/admin");
}
