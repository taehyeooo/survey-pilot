import Link from "next/link";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { listUsers } from "@/lib/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { kst, OpsNav } from "../nav";

// 사용자 목록(multi-user R-11): 가입일 최신순. 정지·해제는 plan 8단계.
async function Users() {
  await requireOperator();
  const users = await listUsers(createAdminClient());
  if (users.length === 0) return <p className="text-muted">아직 가입한 사람이 없어요.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-3 text-left text-muted">{users.length}명</caption>
        <thead className="text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">이메일</th>
            <th className="py-2 pr-3 font-medium whitespace-nowrap">가입</th>
            <th className="py-2 pr-3 font-medium whitespace-nowrap">마지막 로그인</th>
            <th className="py-2 pr-3 text-right font-medium">설문</th>
            <th className="py-2 pr-3 text-right font-medium whitespace-nowrap">AI(24시간)</th>
            <th className="py-2 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2 pr-3 break-all">
                <Link href={`/ops/users/${u.id}`} className="hover:underline">
                  {u.email}
                </Link>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{kst(u.createdAt)}</td>
              <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{kst(u.lastSignInAt)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{u.surveys}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{u.ai24h}</td>
              <td className="py-2 whitespace-nowrap">{u.suspended ? <span className="text-danger">정지</span> : "이용 중"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OpsUsersPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <OpsNav current="users" />
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Users />
      </Suspense>
    </main>
  );
}
