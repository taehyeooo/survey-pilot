import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSessionClient } from "@/lib/supabase/server";
import { LoginForm } from "./login/login-form";

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

// 첫 화면(multi-user R-5, 디자인 1단계 C "바로 시작" 2026-10-30): 왜 만들었는지(막히는 곳) 한 덩이 + 첫 화면에서 바로 이메일.
// 문구는 사용자 말 — "생각하고 다시 써야 하고 말 맞춰야 하는 병목을 해결해 준다".
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <Suspense>
        <SignedInRedirect />
      </Suspense>
      <div className="flex flex-col gap-5">
        <p className="text-sm font-medium text-accent">서베이 파일럿</p>
        <h1 className="text-4xl leading-tight font-bold tracking-[-0.02em]">설문 만들다 막히는 곳, 대신 풀어 드려요</h1>
        <ul className="flex flex-col gap-2 text-lg leading-8 text-muted">
          <li>뭘 물어야 할지 고민하고, 문항을 몇 번씩 다시 쓰고, 말을 맞추느라 시간이 가죠.</li>
          <li>문제 한 줄만 적으면 조사 목적·가설·문항까지 AI가 먼저 짜 드려요.</li>
          <li>응답은 링크로 모으고, 결과는 가설별 리포트로 받아요.</li>
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-box border border-line p-5">
          <LoginForm />
        </div>
        <p className="text-sm text-muted">처음이면 이 칸으로 바로 가입돼요. 비밀번호는 없어요.</p>
      </div>
    </main>
  );
}
