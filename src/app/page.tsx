import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { createSessionClient } from "@/lib/supabase/server";
import { HeroPreview } from "./hero-preview";
import { IconChart, IconLink, IconPencil, IconSparkle } from "./icons";
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

// 첫 화면(multi-user R-5): 가운데 히어로(결정 33) + 옅은 그라데이션·포인트 색·결과 보고서 미리보기(결정 34) → 3단계 → 로그인.
// 문구는 사용자 말 — "생각하고 다시 써야 하고 말 맞춰야 하는 병목을 해결해 준다".
export default function Home() {
  return (
    <main className="hero-glow flex flex-1 flex-col items-center px-6 pt-24 pb-20">
      <Suspense>
        <SignedInRedirect />
      </Suspense>
      <section className="flex max-w-3xl flex-col items-center gap-6 text-center">
        <p className="text-eyebrow inline-flex items-center gap-1.5 rounded-full bg-bg/70 px-3 py-1 text-brand">
          <IconSparkle className="size-4" />
          AI가 함께 만드는 설문
        </p>
        <h1 className="text-display">
          설문 만들다 막히는 곳,
          <br />
          <span className="text-brand">대신 풀어 드려요</span>
        </h1>
        <p className="max-w-xl text-xl leading-8 text-muted">
          뭘 물어야 할지, 문항을 어떻게 쓸지 고민하지 마세요. 문제 한 줄만 적으면 조사 목적·가설·문항까지 AI가 먼저 짜 드려요.
        </p>
      </section>
      <div className="mt-14 flex w-full justify-center">
        <HeroPreview />
      </div>
      <ol className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {(
          [
            ["1", "문제를 적어요", "풀고 싶은 문제 한 줄", IconPencil],
            ["2", "링크로 응답을 받아요", "바로 응답, 이메일 없이도", IconLink],
            ["3", "한눈에 결과를 봐요", "결론·핵심 문제·그래프", IconChart],
          ] as const
        ).map(([n, title, body, Icon], i) => (
          <li key={n} className={`flex flex-col gap-1 rounded-box p-6 text-left ${["bg-tint-1", "bg-tint-2", "bg-tint-3"][i]}`}>
            <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-bg text-brand">
              <Icon className="size-5" />
            </span>
            <span className="text-sm font-semibold text-brand tabular-nums">{n}</span>
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
