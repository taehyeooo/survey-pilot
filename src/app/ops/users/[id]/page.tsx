import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { previewSuspension } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { suspendUser, unsuspendUser } from "../../actions";
import { ConfirmForm, Result } from "../../confirm-form";
import { OpsNav } from "../../nav";

// 정지·해제(multi-user R-12): 미리보기 → 사유·확인 → 실행.
async function Detail({ params, searchParams }: PageProps<"/ops/users/[id]">) {
  await requireOperator();
  const { id } = await params;
  const { done, error } = await searchParams;
  const preview = await previewSuspension(createAdminClient(), id, process.env.ADMIN_EMAIL);
  if (!preview) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Result done={done} error={error} />
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold break-all">{preview.email}</h2>
        <p className="text-muted">{preview.suspended ? "정지됨" : "이용 중"}</p>
      </section>
      {preview.protected ? (
        <p className="rounded-box bg-surface p-4">운영자 계정은 정지할 수 없어요.</p>
      ) : preview.suspended ? (
        <>
          <p className="leading-7 break-keep">해제하면 진행 중인 설문 {preview.openLinks}개의 응답 링크가 다시 응답을 받아요.</p>
          <ConfirmForm action={unsuspendUser.bind(null, id)} label="정지 해제" />
        </>
      ) : (
        <>
          <p className="leading-7 break-keep">
            정지하면 이 사용자는 설문을 만들거나 고칠 수 없고, 진행 중인 설문 {preview.openLinks}개의 응답 링크가 응답을 받지 않아요. 메일로 알리지 않아요.
          </p>
          <ConfirmForm action={suspendUser.bind(null, id)} label="정지하기" danger />
        </>
      )}
    </div>
  );
}

export default function OpsUserPage(props: PageProps<"/ops/users/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <OpsNav current="users" />
      <Link href="/ops/users" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted hover:underline">
        ← 사용자
      </Link>
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Detail {...props} />
      </Suspense>
    </main>
  );
}
