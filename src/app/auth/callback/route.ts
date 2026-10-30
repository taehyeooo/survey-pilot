import { NextResponse, type NextRequest } from "next/server";
import { originOf } from "@/lib/origin";
import { createSessionClient } from "@/lib/supabase/server";

// 매직링크가 돌아오는 곳 — code를 세션으로 바꾸고 관리자 화면으로.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const db = await createSessionClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/app", originOf(request)));
  }
  return NextResponse.redirect(new URL("/login?error=link", originOf(request)));
}
