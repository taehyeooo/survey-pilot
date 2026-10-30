import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { OpsNav } from "../nav";
import { OpsDeletionForm } from "./deletion-form";

// 응답 삭제 요청(multi-user R-15): 응답자가 CONTACT_EMAIL로 요청하면 운영자가 모든 설문에서 찾아 지운다.
async function Requests() {
  await requireOperator();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted break-keep">
        응답자가 자기 응답을 지워 달라고 하면 이메일로 찾아 지워요. 어느 사용자의 설문이든 찾고, 설문 제목과 건수만 보여요. 지운 사람·시각·사유는 설문마다 기록으로 남아요.
      </p>
      <OpsDeletionForm />
    </div>
  );
}

export default function OpsRequestsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <OpsNav current="requests" />
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Requests />
      </Suspense>
    </main>
  );
}
