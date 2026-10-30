import { connection, NextResponse, type NextRequest } from "next/server";
import { isSuspended, loadMember, needsAgreement, ownedSurvey } from "@/lib/members";
import { loadResults, toCsv } from "@/lib/results";
import { createSessionClient } from "@/lib/supabase/server";

// CSV 내려받기(R-25). 세션(RLS)과 주인 조건으로 읽으므로 자기 설문만 받을 수 있다(multi-user R-3).
export async function GET(_request: NextRequest, { params }: RouteContext<"/app/surveys/[id]/export">) {
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return new NextResponse("로그인한 뒤 받을 수 있어요.", { status: 401 });
  const member = await loadMember(db, user.id);
  if (isSuspended(member)) return new NextResponse("이용이 정지됐어요.", { status: 403 });
  if (needsAgreement(member)) return new NextResponse("이용 안내에 동의한 뒤 받을 수 있어요.", { status: 403 });

  const { id } = await params;
  if (!(await ownedSurvey(db, user.id, id, "id"))) return new NextResponse("설문을 찾을 수 없어요.", { status: 404 });

  const { questions, responses, answers } = await loadResults(db, id);
  const date = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return new NextResponse(toCsv(questions, responses, answers), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="survey-${id.slice(0, 8)}-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
