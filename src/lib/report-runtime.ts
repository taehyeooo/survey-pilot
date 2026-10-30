import "server-only";
import { getAi } from "@/lib/ai-runtime";
import { generateReport } from "@/lib/report";
import { createAdminClient } from "@/lib/supabase/admin";

// 마감 직후 최종 리포트(R-24) — after()로 응답 뒤에 돈다. 실패해도(한도·AI 오류) 화면의 "리포트 만들기"로 다시 할 수 있어 기록만 남긴다.
export async function finalReportQuietly(surveyId: string) {
  try {
    await generateReport(createAdminClient(), getAi("report", surveyId), surveyId, "final");
  } catch (error) {
    console.error(`최종 리포트를 만들지 못함 (${surveyId})`, error);
  }
}
