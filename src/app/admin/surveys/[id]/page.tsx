import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireAdmin } from "@/lib/auth";
import type { Clarification } from "@/lib/design";
import { DemoNotice } from "../../demo-notice";
import { StageBar, stageOf } from "../../stage-bar";
import { AI_STEPS } from "../../ai-steps";
import { SubmitButton } from "../../submit-button";
import { answerAndDesign, regenerateDesign, saveAndConfirm } from "../actions";
import { OtherOption } from "./other-option";
import { QuestionsSection, type Question } from "./questions";

// 조사 설계(디자인 결정 27 C 단계형): 위에 단계 진행, 설계 폼은 묶음별 카드.
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
  questions: Question[];
}

const KST_MS = 9 * 60 * 60 * 1000;
const toKstInput = (iso: string) => new Date(new Date(iso).getTime() + KST_MS).toISOString().slice(0, 16);
const kstFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

function ClarifyForm({ survey }: { survey: Survey }) {
  return (
    <form action={answerAndDesign.bind(null, survey.id)} className="flex flex-col gap-6">
      <p className="text-muted">설계 전에 몇 가지만 알려 주세요.</p>
      {survey.clarifications.map((c, i) => (
        <fieldset key={i} className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">{c.question}</legend>
          {c.options.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3 rounded-box border border-line px-3">
              <input type="radio" name={`answer-${i}`} value={option} required />
              {option}
            </label>
          ))}
          <OtherOption index={i} question={c.question} />
        </fieldset>
      ))}
      <SubmitButton pendingSteps={AI_STEPS.design}>설계 만들기</SubmitButton>
    </form>
  );
}

function Card({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`group-${index}`} className="flex flex-col gap-4 rounded-box border border-line p-5">
      <h2 id={`group-${index}`} className="text-sm font-medium text-muted">
        {index}. {title}
      </h2>
      {children}
    </section>
  );
}

function DesignForm({ survey }: { survey: Survey }) {
  const slots = Array.from({ length: 4 }, (_, i) => survey.hypotheses[i]?.statement ?? "");
  return (
    <form action={saveAndConfirm.bind(null, survey.id)} className="flex flex-col gap-5">
      <Card index={1} title="무엇을 확인하나">
        <label className="flex flex-col gap-2">
          <span className="font-medium">조사 목적</span>
          <input name="purpose" required defaultValue={survey.purpose ?? ""} className="field" />
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
              className="field"
            />
          ))}
        </fieldset>
      </Card>
      <Card index={2} title="누구에게, 얼마나">
        <label className="flex flex-col gap-2">
          <span className="font-medium">응답 대상</span>
          <input name="audience" required defaultValue={survey.audience ?? ""} className="field" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="font-medium">목표 응답 수</span>
            <input name="target_responses" type="number" min={1} required defaultValue={survey.target_responses ?? ""} className="field" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-medium">소요 시간(분)</span>
            <input name="target_minutes" type="number" min={1} max={30} required defaultValue={survey.target_minutes ?? ""} className="field" />
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
            className="field"
          />
        </label>
      </Card>
      <Card index={3} title="어떻게 알리나">
        <label className="flex flex-col gap-2">
          <span className="font-medium">소개글</span>
          <textarea name="intro" rows={3} required defaultValue={survey.intro ?? ""} className="field py-2" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-medium">공유 메시지</span>
          <textarea name="share_message" rows={2} required defaultValue={survey.share_message ?? ""} className="field py-2" />
        </label>
      </Card>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingSteps={AI_STEPS.save}>이대로 확인</SubmitButton>
        <SubmitButton variant="secondary" formAction={regenerateDesign.bind(null, survey.id)} pendingSteps={AI_STEPS.design}>
          다시 제안받기
        </SubmitButton>
      </div>
    </form>
  );
}

function ConfirmedSummary({ survey }: { survey: Survey }) {
  return (
    <section className="flex flex-col gap-4">
      <p role="status" className="rounded-box bg-surface p-4">
        설계를 확인했어요.
      </p>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted">조사 목적</dt>
          <dd>{survey.purpose}</dd>
        </div>
        <div>
          <dt className="text-muted">가설</dt>
          <dd>
            <ol className="list-decimal pl-5">
              {survey.hypotheses.map((h) => (
                <li key={h.position}>{h.statement}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt className="text-muted">대상 · 목표 · 시간 · 마감</dt>
          <dd>
            {survey.audience} · {survey.target_responses}명 · {survey.target_minutes}분 · {survey.closes_at && kstFormat.format(new Date(survey.closes_at))}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Body({ survey }: { survey: Survey }) {
  if (survey.status === "reviewing") {
    return (
      <div className="flex flex-col gap-8">
        <details className="rounded-box border border-line p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">확인한 설계 보기</summary>
          <div className="mt-3">
            <ConfirmedSummary survey={survey} />
          </div>
        </details>
        <QuestionsSection surveyId={survey.id} questions={survey.questions} targetMinutes={survey.target_minutes ?? 3} />
      </div>
    );
  }
  if (survey.status !== "designing") return <ConfirmedSummary survey={survey} />;
  if (survey.purpose) return <DesignForm survey={survey} />;
  if (survey.clarifications.some((c) => !c.answer)) return <ClarifyForm survey={survey} />;
  return (
    <form action={regenerateDesign.bind(null, survey.id)} className="flex flex-col gap-3">
      <p className="text-muted">아직 설계가 없어요.</p>
      <SubmitButton pendingSteps={AI_STEPS.design}>설계 만들기</SubmitButton>
    </form>
  );
}

async function SurveyDesign({ params, searchParams }: PageProps<"/admin/surveys/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const { error, moved } = await searchParams;
  const { data } = await db
    .from("surveys")
    .select("*, hypotheses(position, statement), questions(id, position, type, prompt, options, required, review_note)")
    .eq("id", id)
    .order("position", { referencedTable: "hypotheses" })
    .order("position", { referencedTable: "questions" })
    .maybeSingle();
  if (!data) notFound();
  const survey = data as Survey;

  return (
    <>
      <StageBar current={stageOf(survey)} animate={moved === "1"} className="mb-8" />
      {isDemoAi() && <DemoNotice />}
      <p className="mb-6 rounded-box border border-line p-4 leading-7">{survey.problem}</p>
      {typeof error === "string" && (
        <p role="alert" className="mb-6 rounded-box bg-danger-bg p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Body survey={survey} />
    </>
  );
}

export default function SurveyPage(props: PageProps<"/admin/surveys/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/admin" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted hover:underline">
        ← 내 설문
      </Link>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <SurveyDesign {...props} />
      </Suspense>
    </main>
  );
}
