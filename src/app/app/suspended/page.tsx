import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSignedIn } from "@/lib/auth";
import { isSuspended, loadMember } from "@/lib/members";
import { logout } from "../actions";

// 정지 안내(multi-user R-8). 사유는 보이지 않는다. 화면 디자인은 plan 11단계에서 다듬는다.
async function Notice() {
  const { db, user } = await requireSignedIn();
  if (!isSuspended(await loadMember(db, user.id))) redirect("/app");
  return (
    <>
      <p className="leading-7 break-keep">
        지금은 설문을 만들거나 고칠 수 없고, 내 설문의 응답 링크도 응답을 받지 않아요. 궁금한 점은 운영자에게 물어봐 주세요.
      </p>
      <Link href="/app/leave" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
        탈퇴하기
      </Link>
      <form action={logout}>
        <button type="submit" className="min-h-11 rounded-box border border-line px-4 font-medium">
          로그아웃
        </button>
      </form>
    </>
  );
}

export default function SuspendedPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">이용이 정지됐어요</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <Notice />
      </Suspense>
    </main>
  );
}
