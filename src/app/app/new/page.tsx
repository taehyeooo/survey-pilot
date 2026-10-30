import Link from "next/link";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireMember } from "@/lib/auth";
import { DemoNotice } from "../demo-notice";
import { StageBar } from "../stage-bar";
import { ProblemForm } from "./problem-form";

// 새 설문(디자인 결정 27 C 단계형): 화면 가운데 큰 질문 하나.
async function NewSurvey() {
  await requireMember();
  return (
    <>
      {isDemoAi() && <DemoNotice />}
      <ProblemForm hero />
    </>
  );
}

export default function NewSurveyPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center gap-6 px-4 py-8">
      <Link href="/app" className="inline-flex min-h-11 items-center self-start text-sm text-muted hover:underline">
        ← 내 설문
      </Link>
      <StageBar current={0} />
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <NewSurvey />
      </Suspense>
    </main>
  );
}
