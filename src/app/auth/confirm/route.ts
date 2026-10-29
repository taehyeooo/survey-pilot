import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { originOf } from "@/lib/origin";
import { createSessionClient } from "@/lib/supabase/server";

// token_hash 방식 로그인 — 링크를 요청한 브라우저가 아니어도(예: 휴대폰 메일 앱) 로그인된다.
// 쓰려면 Supabase 메일 템플릿 링크를 {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email 로 바꾼다.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const db = await createSessionClient();
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/admin", originOf(request)));
  }
  return NextResponse.redirect(new URL("/login?error=link", originOf(request)));
}
