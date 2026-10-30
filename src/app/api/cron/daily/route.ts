import { connection, NextResponse, type NextRequest } from "next/server";
import { getAi } from "@/lib/ai-runtime";
import { isCronAuthorized, runDaily } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

// 하루 1회 크론(vercel.json, KST 00:10). Vercel은 CRON_SECRET이 있으면 Authorization: Bearer <값>을 붙여 부른다.
export const maxDuration = 60; // 리포트 몇 개를 만들 시간

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  await connection();
  const result = await runDaily(createAdminClient(), getAi("cron-report"));
  return NextResponse.json(result);
}
