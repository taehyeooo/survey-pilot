"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { leaveAccount } from "@/lib/account";
import { requireSignedIn } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// 탈퇴(multi-user R-7). 정지된 사용자도 탈퇴할 수 있게 로그인만 확인한다.
export async function leave(formData: FormData) {
  const { user } = await requireSignedIn();
  try {
    await leaveAccount(createAdminClient(), { userId: user.id, confirm: String(formData.get("confirm") ?? ""), adminEmail: process.env.ADMIN_EMAIL });
  } catch (e) {
    if (!(e instanceof RangeError)) console.error(e);
    redirect(`/app/leave?error=${encodeURIComponent(e instanceof RangeError ? e.message : "탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.")}`);
  }
  await signOut(); // 사용자는 이미 지워졌다 — 남은 세션 쿠키만 비운다
  redirect("/login?error=left");
}
