import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiClient } from "@/lib/ai";
import { generateReport } from "@/lib/report";
import { closeOverdue } from "@/lib/submit";

// 하루 1회 크론(KST 00:10, vercel.json): 마감일 마감(R-16) → 최종 리포트 없는 설문 리포트(R-24)
// → 마감 30일 지난 이메일 원문 정리(R-30, ADR 0017) → 하루 지난 인증번호 삭제.
// db는 서버(service role) 클라이언트. 한 번에 만드는 리포트 수는 무료 한도 때문에 제한한다(ADR 0018).

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORTS_PER_RUN = 5;

export function isCronAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

// scope: 테스트가 실제 프로젝트의 다른 설문을 건드리지 않게 소유자로 좁힌다. 실제 크론은 범위 없이 전체.
// aiFor: 설문마다 AI를 받는다 — 사용 기록에 설문과 주인을 남긴다(multi-user R-9).
export async function runDaily(db: SupabaseClient, aiFor: (surveyId: string) => AiClient, now = Date.now(), scope?: { ownerId: string }) {
  await closeOverdue(db, new Date(now), scope?.ownerId);

  // 마감됐는데 최종 리포트가 없는 설문(응답이 있는 것만)
  let closedQuery = db.from("surveys").select("id, reports(kind), responses(count)").eq("status", "closed");
  if (scope) closedQuery = closedQuery.eq("owner_id", scope.ownerId);
  const { data: closed } = await closedQuery.throwOnError();
  const pending = (closed ?? []).filter(
    (s) => !(s.reports as { kind: string }[]).some((r) => r.kind === "final") && ((s.responses as { count: number }[])[0]?.count ?? 0) > 0,
  );
  let reports = 0;
  for (const s of pending.slice(0, REPORTS_PER_RUN)) {
    try {
      await generateReport(db, aiFor(s.id), s.id, "final");
      reports++;
    } catch (error) {
      console.error(`크론: 최종 리포트 실패 (${s.id})`, error); // 다음 날 다시, 또는 화면 버튼
    }
  }

  // 마감 30일 지난 설문의 이메일 원문 → null (중복 확인·삭제 요청용 해시는 남긴다)
  let expiredQuery = db.from("surveys").select("id").eq("status", "closed").lte("closed_at", new Date(now - 30 * DAY_MS).toISOString());
  if (scope) expiredQuery = expiredQuery.eq("owner_id", scope.ownerId);
  const { data: expired } = await expiredQuery.throwOnError();
  const expiredIds = (expired ?? []).map((s) => s.id);
  let emails = 0;
  if (expiredIds.length) {
    const { count } = await db
      .from("respondents")
      .update({ email: null }, { count: "exact" })
      .in("survey_id", expiredIds)
      .not("email", "is", null)
      .throwOnError();
    emails = count ?? 0;
  }

  // 인증번호: 하루 지난 것 삭제 — 최근 1시간 것은 IP 제한·재발송 간격 계산에 쓰인다
  let removeCodes = db.from("verifications").delete({ count: "exact" }).lt("sent_at", new Date(now - DAY_MS).toISOString());
  if (scope) {
    const { data: mine } = await db.from("surveys").select("id").eq("owner_id", scope.ownerId).throwOnError();
    removeCodes = removeCodes.in("survey_id", (mine ?? []).map((s) => s.id));
  }
  const { count: codes } = await removeCodes.throwOnError();

  return { reports, pendingReports: pending.length, emails, codes: codes ?? 0 };
}
