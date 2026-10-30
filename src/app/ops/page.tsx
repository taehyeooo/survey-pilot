import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { usageSummary } from "@/lib/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsNav } from "./nav";

// 운영 개요: 최근 24시간 한도 사용량과 사용자별 순위(multi-user R-13). 화면 디자인은 plan 11단계.
async function Overview() {
  await requireOperator();
  const { ai, mail, ranking, unattributed } = await usageSummary(createAdminClient());
  const meter = (label: string, { used, limit }: { used: number; limit: number }) => (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {used} <span className="text-base font-normal text-muted">/ {limit}</span>
      </p>
    </div>
  );
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="usage" className="flex flex-col gap-3">
        <h2 id="usage" className="text-sm font-medium text-muted">
          최근 24시간 사용량
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {meter("AI", ai)}
          {meter("인증번호 메일", mail)}
        </div>
      </section>
      <section aria-labelledby="ranking" className="flex flex-col gap-3">
        <h2 id="ranking" className="text-sm font-medium text-muted">
          사용자별
        </h2>
        {unattributed > 0 && <p className="text-sm text-muted">사용자가 남지 않은 기록 {unattributed}건(사용자를 남기기 전 기록이나 탈퇴한 사용자)</p>}
        {ranking.length === 0 ? (
          <p className="text-muted">사용자별 기록이 아직 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">이메일</th>
                  <th className="py-2 pr-3 text-right font-medium">AI</th>
                  <th className="py-2 text-right font-medium">메일</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.userId} className="border-t border-line">
                    <td className="py-2 pr-3 break-all">{r.email}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.ai}</td>
                    <td className="py-2 text-right tabular-nums">{r.mail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function OpsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <OpsNav current="overview" />
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}
