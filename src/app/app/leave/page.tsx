import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LEAVE_WORD, previewLeave } from "@/lib/account";
import { requireSignedIn } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitButton } from "../submit-button";
import { leave } from "./actions";

// 탈퇴(multi-user R-7): 미리보기 → 확인 글자 → 즉시 삭제. 화면 디자인은 plan 11단계에서 다듬는다.
async function Leave({ searchParams }: PageProps<"/app/leave">) {
  const { user } = await requireSignedIn();
  const { error } = await searchParams;
  const preview = await previewLeave(createAdminClient(), user.id, process.env.ADMIN_EMAIL);
  if (!preview) notFound();
  if (preview.protected) return <p className="rounded-box bg-surface p-4">운영자 계정은 탈퇴할 수 없어요.</p>;
  return (
    <>
      <ul className="flex list-disc flex-col gap-3 pl-5 leading-7 break-keep">
        <li>
          설문 {preview.surveys}개와 응답 {preview.responses}개가 바로 지워지고 되돌릴 수 없어요.
        </li>
        <li>진행 중인 설문의 응답 링크도 바로 열리지 않아요.</li>
        <li>필요한 결과는 먼저 설문 화면에서 CSV로 받아 두세요.</li>
      </ul>
      <form action={leave} className="flex flex-col gap-3 rounded-box bg-surface p-4">
        <label htmlFor="confirm" className="text-sm font-medium">
          확인을 위해 &ldquo;{LEAVE_WORD}&rdquo;를 적어 주세요
        </label>
        <input id="confirm" name="confirm" required autoComplete="off" className="field" />
        {typeof error === "string" && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <SubmitButton pendingSteps={["지우는 중…"]} variant="secondary">
          탈퇴하기
        </SubmitButton>
      </form>
    </>
  );
}

export default function LeavePage(props: PageProps<"/app/leave">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12">
      <Link href="/app" className="inline-flex min-h-11 items-center self-start text-sm text-muted hover:underline">
        ← 내 설문
      </Link>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">탈퇴하기</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <Leave {...props} />
      </Suspense>
    </main>
  );
}
