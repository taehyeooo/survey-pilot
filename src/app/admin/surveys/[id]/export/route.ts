import { connection, NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { loadResults, toCsv } from "@/lib/results";
import { createSessionClient } from "@/lib/supabase/server";

// CSV 내려받기(R-25). 관리자 세션(RLS)으로 읽으므로 자기 설문만 받을 수 있다.
export async function GET(_request: NextRequest, { params }: RouteContext<"/admin/surveys/[id]/export">) {
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user || !isAdminEmail(user.email, process.env.ADMIN_EMAIL)) return new NextResponse("관리자만 받을 수 있어요.", { status: 403 });

  const { id } = await params;
  const { data: survey } = await db.from("surveys").select("id").eq("id", id).maybeSingle();
  if (!survey) return new NextResponse("설문을 찾을 수 없어요.", { status: 404 });

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
