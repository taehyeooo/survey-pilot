import Link from "next/link";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireAdmin } from "@/lib/auth";
import { DemoNotice } from "../demo-notice";
import { uxOf, withUx } from "../ux";
import { ProblemForm } from "./problem-form";

const TIPS = [
  { title: "누구", text: "응답할 사람이 누구인가요? 예: 주 2회 저녁 스터디 회원" },
  { title: "언제·어디서", text: "문제가 언제부터, 어디서 보였나요? 예: 3개월 전부터" },
  { title: "무엇을 정하려고", text: "결과로 무엇을 결정하나요? 예: 모임 요일을 바꿀지" },
];

async function NewSurvey({ searchParams }: PageProps<"/admin/new">) {
  await requireAdmin();
  const ux = uxOf((await searchParams).ux);
  const back = (
    <Link href={withUx("/admin", ux)} className="text-sm text-muted hover:underline">
      ← 내 설문
    </Link>
  );

  // B 작업대형: 왼쪽 입력, 오른쪽 좋은 문제 정의 안내
  if (process.env.NODE_ENV !== "production" && ux === "b") {
    return (
      <div className="mx-auto max-w-4xl">
        {back}
        <h1 className="mt-4 mb-6 text-xl font-semibold">새 설문</h1>
        {isDemoAi() && <DemoNotice />}
        <div className="grid gap-8 md:grid-cols-[1fr_260px]">
          <ProblemForm ux={ux} />
          <aside aria-label="좋은 문제 정의" className="rounded-box bg-surface p-4 text-sm">
            <h2 className="mb-3 font-medium">이 세 가지가 있으면 바로 설계해요</h2>
            <dl className="flex flex-col gap-3">
              {TIPS.map((tip) => (
                <div key={tip.title}>
                  <dt className="font-medium">{tip.title}</dt>
                  <dd className="text-muted break-keep">{tip.text}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    );
  }

  // C 단계형: 화면 가운데 큰 질문 하나, 위에 단계 표시
  if (process.env.NODE_ENV !== "production" && ux === "c") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center gap-6">
        {back}
        <p className="text-sm text-muted">1 / 5 · 문제</p>
        {isDemoAi() && <DemoNotice />}
        <ProblemForm ux={ux} hero />
      </div>
    );
  }

  // A 문서형
  return (
    <div className="mx-auto max-w-2xl">
      {back}
      <h1 className="mt-4 mb-6 text-xl font-semibold">새 설문</h1>
      {isDemoAi() && <DemoNotice />}
      <ProblemForm ux={ux} />
    </div>
  );
}

export default function NewSurveyPage(props: PageProps<"/admin/new">) {
  return (
    <main className="w-full px-4 py-8">
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <NewSurvey {...props} />
      </Suspense>
    </main>
  );
}
