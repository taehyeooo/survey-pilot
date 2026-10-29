import Link from "next/link";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireAdmin } from "@/lib/auth";
import { DemoNotice } from "../demo-notice";
import { ProblemForm } from "./problem-form";

async function Guarded() {
  await requireAdmin();
  return (
    <>
      {isDemoAi() && <DemoNotice />}
      <ProblemForm />
    </>
  );
}

export default function NewSurveyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← 내 설문
      </Link>
      <h1 className="mt-4 mb-6 text-xl font-semibold">새 설문</h1>
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}
