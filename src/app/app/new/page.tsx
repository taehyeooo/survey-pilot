import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireMember } from "@/lib/auth";
import { DemoNotice } from "../demo-notice";
import { PageHead } from "../page-head";
import { ProblemForm } from "./problem-form";

// 새 설문(결정 37, 시안 "03 정돈된 도구"의 첫 화면): 큰 질문 하나 → 캐릭터 말풍선·입력 칸·예시 → 4단계 안내.
const STEPS = [
  ["01", "문제", "한 줄로 정의"],
  ["02", "설계", "AI가 가설 생성"],
  ["03", "응답", "링크로 수집"],
  ["04", "리포트", "결론과 다음 행동"],
] as const;

async function NewSurvey() {
  await requireMember();
  return (
    <>
      {isDemoAi() && <DemoNotice />}
      <ProblemForm />
    </>
  );
}

export default function NewSurveyPage() {
  return (
    <>
      <PageHead crumbs={[{ label: "내 설문", href: "/app" }, { label: "새 설문" }]} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-12">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold tracking-wide text-brand">SURVEY PILOT AI</p>
          <h1 className="text-headline">풀고 싶은 문제부터 적어 주세요.</h1>
          <p className="text-muted">조사 목적, 가설, 문항을 서베이 파일럿이 짜 드려요.</p>
        </div>
        <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
          <NewSurvey />
        </Suspense>
        <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-box border border-line bg-line sm:grid-cols-4">
          {STEPS.map(([n, title, body]) => (
            <li key={n} className="flex flex-col gap-0.5 bg-bg p-4">
              <span className="text-xs text-muted tabular-nums">{n}</span>
              <span className="font-semibold">{title}</span>
              <span className="text-xs text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
