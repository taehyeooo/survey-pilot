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
    <main className="flex flex-1 flex-col items-center px-6 pt-24 pb-20">
      <Suspense>
        <SignedInRedirect />
      </Suspense>
      <section className="flex max-w-3xl flex-col items-center gap-6 text-center">
        <p className="text-eyebrow">서베이 파일럿</p>
        <h1 className="text-display">
          설문 만들다 막히는 곳,
          <br />
          대신 풀어 드려요
        </h1>
        <p className="max-w-xl text-xl leading-8 text-muted">
          뭘 물어야 할지, 문항을 어떻게 쓸지 고민하지 마세요. 문제 한 줄만 적으면 조사 목적·가설·문항까지 AI가 먼저 짜 드려요.
        </p>
      </section>
      <ol className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {[
          ["1", "문제를 적어요", "풀고 싶은 문제 한 줄"],
          ["2", "링크로 응답을 받아요", "바로 응답, 이메일 없이도"],
          ["3", "한눈에 결과를 봐요", "결론·핵심 문제·그래프"],
        ].map(([n, title, body], i) => (
          <li key={n} className={`flex flex-col gap-1 rounded-box p-6 text-left ${["bg-tint-1", "bg-tint-2", "bg-tint-3"][i]}`}>
            <span className="text-sm font-semibold tabular-nums">{n}</span>
            <span className="text-lg font-semibold">{title}</span>
            <span className="text-muted">{body}</span>
          </li>
        ))}
      </ol>
      <div className="mt-16 w-full max-w-md">
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
