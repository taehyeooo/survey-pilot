import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireAdmin } from "@/lib/auth";
import type { Clarification } from "@/lib/design";
import { DemoNotice } from "../../demo-notice";
import { SubmitButton } from "../../submit-button";
import { uxOf, withUx, type Ux } from "../../ux";
import { answerAndDesign, regenerateDesign, saveAndConfirm } from "../actions";
import { OtherOption } from "./other-option";

interface Survey {
  id: string;
  status: string;
  problem: string;
  clarifications: Clarification[];
  purpose: string | null;
  audience: string | null;
  target_responses: number | null;
  target_minutes: number | null;
  closes_at: string | null;
  intro: string | null;
  share_message: string | null;
  hypotheses: { position: number; statement: string }[];
}

const field = "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const KST_MS = 9 * 60 * 60 * 1000;
const toKstInput = (iso: string) => new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 16);
const kstFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

const UxField = ({ ux }: { ux: Ux }) => <input type="hidden" name="ux" value={ux} />;

function ClarifyForm({ survey, ux }: { survey: Survey; ux: Ux }) {
  return (
    <form action={answerAndDesign.bind(null, survey.id)} className="flex flex-col gap-6">
      <UxField ux={ux} />
      <p className="text-zinc-600 dark:text-zinc-400">설계 전에 몇 가지만 알려 주세요.</p>
      {survey.clarifications.map((c, i) => (
        <fieldset key={i} className="flex flex-col gap-2">
          <legend className="mb-2 font-medium break-keep">{c.question}</legend>
          {c.options.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800">
              <input type="radio" name={`answer-${i}`} value={option} required />
              {option}
            </label>
          ))}
          <OtherOption index={i} question={c.question} />
        </fieldset>
      ))}
      <SubmitButton pendingText="AI가 설계하는 중…">설계 만들기</SubmitButton>
    </form>
  );
}

// 설계 폼의 세 묶음 — A·B는 위에서 아래로 이어서, C는 묶음마다 카드로.
function DesignForm({ survey, ux, cards = false }: { survey: Survey; ux: Ux; cards?: boolean }) {
  const slots = Array.from({ length: 4 }, (_, i) => survey.hypotheses[i]?.statement ?? "");
  const groups = [
    {
      title: "무엇을 확인하나",
      body: (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-medium">조사 목적</span>
            <input name="purpose" required defaultValue={survey.purpose ?? ""} className={field} />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">확인할 가설 (2~4개)</legend>
            {slots.map((h, i) => (
              <input
                key={i}
                name="hypothesis"
                defaultValue={h}
                required={i < 2}
                aria-label={`가설 ${i + 1}`}
                placeholder={i >= 2 ? "(선택)" : undefined}
                className={field}
              />
            ))}
          </fieldset>
        </>
      ),
    },
    {
      title: "누구에게, 얼마나",
      body: (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-medium">응답 대상</span>
            <input name="audience" required defaultValue={survey.audience ?? ""} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="font-medium">목표 응답 수</span>
              <input name="target_responses" type="number" min={1} required defaultValue={survey.target_responses ?? ""} className={field} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-medium">소요 시간(분)</span>
              <input name="target_minutes" type="number" min={1} max={30} required defaultValue={survey.target_minutes ?? ""} className={field} />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="font-medium">마감 (한국 시간)</span>
            <input
              name="closes_at"
              type="datetime-local"
              required
              min={toKstInput(new Date().toISOString())}
              defaultValue={survey.closes_at ? toKstInput(survey.closes_at) : ""}
              className={field}
            />
          </label>
        </>
      ),
    },
    {
      title: "어떻게 알리나",
      body: (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-medium">소개글</span>
            <textarea name="intro" rows={3} required defaultValue={survey.intro ?? ""} className={field} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">공유 메시지</span>
            <textarea name="share_message" rows={2} required defaultValue={survey.share_message ?? ""} className={field} />
          </label>
        </>
      ),
    },
  ];

  return (
    <form action={saveAndConfirm.bind(null, survey.id)} className="flex flex-col gap-5">
      <UxField ux={ux} />
      {cards
        ? groups.map((g, i) => (
            <section key={g.title} aria-labelledby={`group-${i}`} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 id={`group-${i}`} className="text-sm font-medium text-zinc-500">
                {i + 1}. {g.title}
              </h2>
              {g.body}
            </section>
          ))
        : groups.map((g) => <div key={g.title} className="contents">{g.body}</div>)}
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingText="저장하는 중…">이대로 확인</SubmitButton>
        <SubmitButton variant="secondary" formAction={regenerateDesign.bind(null, survey.id)} pendingText="AI가 다시 설계하는 중…">
          다시 제안받기
        </SubmitButton>
      </div>
    </form>
  );
}

function ConfirmedSummary({ survey }: { survey: Survey }) {
  return (
    <section className="flex flex-col gap-4">
      <p role="status" className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
        설계를 확인했어요. 다음 단계에서 이 가설로 문항을 만들어요.
      </p>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">조사 목적</dt>
          <dd className="break-keep">{survey.purpose}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">가설</dt>
          <dd>
            <ol className="list-decimal pl-5">
              {survey.hypotheses.map((h) => (
                <li key={h.position} className="break-keep">
                  {h.statement}
                </li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">대상 · 목표 · 시간 · 마감</dt>
          <dd>
            {survey.audience} · {survey.target_responses}명 · {survey.target_minutes}분 · {survey.closes_at && kstFormat.format(new Date(survey.closes_at))}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Body({ survey, ux, cards }: { survey: Survey; ux: Ux; cards?: boolean }) {
  if (survey.status !== "designing") return <ConfirmedSummary survey={survey} />;
  if (survey.purpose) return <DesignForm survey={survey} ux={ux} cards={cards} />;
  if (survey.clarifications.some((c) => !c.answer)) return <ClarifyForm survey={survey} ux={ux} />;
  return (
    <form action={regenerateDesign.bind(null, survey.id)} className="flex flex-col gap-3">
      <UxField ux={ux} />
      <p className="text-zinc-600 dark:text-zinc-400">아직 설계가 없어요.</p>
      <SubmitButton pendingText="AI가 설계하는 중…">설계 만들기</SubmitButton>
    </form>
  );
}

const STAGES = ["문제", "설계", "문항", "응답", "리포트"];
function stageOf(survey: Survey) {
  if (survey.status === "closed") return 4;
  if (survey.status === "published") return 3;
  if (survey.status === "reviewing") return 2;
  return survey.purpose ? 1 : 0;
}

async function SurveyDesign({ params, searchParams }: PageProps<"/admin/surveys/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const { error, ux: rawUx } = await searchParams;
  const ux = uxOf(rawUx);
  const { data } = await db
    .from("surveys")
    .select("*, hypotheses(position, statement)")
    .eq("id", id)
    .order("position", { referencedTable: "hypotheses" })
    .maybeSingle();
  if (!data) notFound();
  const survey = data as Survey;

  const back = (
    <Link href={withUx("/admin", ux)} className="text-sm text-zinc-500 hover:underline">
      ← 내 설문
    </Link>
  );
  const alert =
    typeof error === "string" ? (
      <p role="alert" className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
        {error}
      </p>
    ) : null;
  const problem = <p className="rounded-lg border border-zinc-200 p-4 leading-7 break-keep dark:border-zinc-800">{survey.problem}</p>;

  // B 작업대형: 왼쪽에 문제·되묻기 답(맥락), 오른쪽에 폼
  if (process.env.NODE_ENV !== "production" && ux === "b") {
    const answered = survey.clarifications.filter((c) => c.answer);
    return (
      <div className="mx-auto max-w-5xl">
        {back}
        <h1 className="mt-4 mb-6 text-xl font-semibold">조사 설계</h1>
        {isDemoAi() && <DemoNotice />}
        <div className="grid gap-8 md:grid-cols-[260px_1fr]">
          <aside className="flex flex-col gap-4 md:sticky md:top-8 md:self-start">
            <h2 className="text-sm font-medium text-zinc-500">문제</h2>
            {problem}
            {answered.length > 0 && (
              <dl className="flex flex-col gap-2 text-sm">
                {answered.map((c) => (
                  <div key={c.question}>
                    <dt className="text-zinc-500 break-keep">{c.question}</dt>
                    <dd className="break-keep">{c.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </aside>
          <div>
            {alert}
            <Body survey={survey} ux={ux} />
          </div>
        </div>
      </div>
    );
  }

  // C 단계형: 위에 5단계 진행, 설계는 묶음별 카드
  if (process.env.NODE_ENV !== "production" && ux === "c") {
    const current = stageOf(survey);
    return (
      <div className="mx-auto max-w-2xl">
        {back}
        <ol aria-label={`지금 단계: ${STAGES[current]}`} className="mt-4 mb-8 grid grid-cols-5 gap-1">
          {STAGES.map((label, i) => (
            <li key={label} className="flex flex-col gap-1">
              <span aria-hidden className={`h-1 rounded-full ${i <= current ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`} />
              <span className={`text-xs ${i === current ? "font-medium" : "text-zinc-500"}`}>{label}</span>
            </li>
          ))}
        </ol>
        {isDemoAi() && <DemoNotice />}
        <div className="mb-6">{problem}</div>
        {alert}
        <Body survey={survey} ux={ux} cards />
      </div>
    );
  }

  // A 문서형
  return (
    <div className="mx-auto max-w-2xl">
      {back}
      <h1 className="mt-4 mb-6 text-xl font-semibold">조사 설계</h1>
      {isDemoAi() && <DemoNotice />}
      <div className="mb-6">{problem}</div>
      {alert}
      <Body survey={survey} ux={ux} />
    </div>
  );
}

export default function SurveyPage(props: PageProps<"/admin/surveys/[id]">) {
  return (
    <main className="w-full px-4 py-8">
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <SurveyDesign {...props} />
      </Suspense>
    </main>
  );
}
