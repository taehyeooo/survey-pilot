import Link from "next/link";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { listAllSurveys } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsNav } from "../nav";

const STATUS: Record<string, string> = { designing: "만드는 중", reviewing: "만드는 중", published: "진행 중", closed: "마감" };

// 전체 설문(multi-user R-14): 제목·주인·상태·응답 수만. 문항·답·리포트는 보지 않는다.
async function Surveys() {
  await requireOperator();
  const surveys = await listAllSurveys(createAdminClient());
  if (surveys.length === 0) return <p className="text-muted">아직 설문이 없어요.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-3 text-left text-muted">{surveys.length}개</caption>
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">문제</th>
            <th className="py-2 pr-3 font-medium">주인</th>
            <th className="py-2 pr-3 font-medium whitespace-nowrap">상태</th>
            <th className="py-2 text-right font-medium">응답</th>
          </tr>
        </thead>
        <tbody>
          {surveys.map((s) => (
            <tr key={s.id} className="border-t border-line">
              <td className="py-2 pr-3">
                <Link href={`/ops/surveys/${s.id}`} className="line-clamp-2 hover:underline">
                  {s.problem}
                </Link>
              </td>
              <td className="py-2 pr-3 break-all">{s.ownerEmail}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{s.takenDown ? <span className="text-danger">내림</span> : (STATUS[s.status] ?? s.status)}</td>
              <td className="py-2 text-right tabular-nums">{s.responses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OpsSurveysPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <OpsNav current="surveys" />
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Surveys />
      </Suspense>
    </main>
  );
}
