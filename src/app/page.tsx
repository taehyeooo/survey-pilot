import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSessionClient } from "@/lib/supabase/server";

// 로그인한 상태면 바로 내 설문으로(multi-user R-5).
async function SignedInRedirect() {
  await connection();
  const db = await createSessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user) redirect("/app");
  return null;
}

// 첫 화면: 소개 3줄과 시작하기. 화면 디자인은 plan 11단계에서 다듬는다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <Suspense>
        <SignedInRedirect />
      </Suspense>
      <h1 className="text-2xl font-semibold">서베이 파일럿</h1>
      <ul className="mt-4 flex flex-col gap-2 text-muted break-keep">
        <li>풀고 싶은 문제를 적으면 AI가 조사 설계와 문항을 만들어요.</li>
        <li>링크로 응답을 받고, 이메일 인증으로 한 사람에 한 번만 받아요.</li>
        <li>응답이 모이면 가설별로 정리한 리포트를 보여 줘요.</li>
      </ul>
      <Link href="/login" className="mt-6 inline-flex min-h-11 items-center self-start rounded-box bg-accent px-4 font-medium text-on-accent">
        시작하기
      </Link>
    </main>
  );
}
