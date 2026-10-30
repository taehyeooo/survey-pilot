import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isDemoAi } from "@/lib/ai-runtime";
import { requireMember } from "@/lib/auth";
import type { Clarification } from "@/lib/design";
import { buildShareText, canEditQuestions } from "@/lib/publish";
import { createAdminClient } from "@/lib/supabase/admin";
import { latestReport, type ReportRow } from "@/lib/report";
import { loadResults, type QuestionStat } from "@/lib/results";
import { closeOverdue } from "@/lib/submit";
import { DemoNotice } from "../../demo-notice";
import { StageBar, stageOf } from "../../stage-bar";
import { AI_STEPS } from "../../ai-steps";
import { SubmitButton } from "../../submit-button";
import { answerAndDesign, closeNow, publish, regenerateDesign, saveAndConfirm, saveResponseMode, saveSettings } from "../actions";
import { OtherOption } from "./other-option";
import { QuestionsSection, type Question } from "./questions";
import { DeleteRequest } from "./delete-request";
import { ReportSection } from "./report";
import { ResultsSection } from "./results";
import { ShareBox } from "./share-box";

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
  slug: string | null;
  close_reason: string | null;
  taken_down_at: string | null;
  require_email: boolean;
  hypotheses: { position: number; statement: string }[];
  questions: Question[];
}

const STATUS_LABEL: Record<string, string> = { designing: "설계 중", reviewing: "문항 확인 중", published: "응답 받는 중", closed: "마감" };
const STATUS_TONE: Record<string, string> = {
  designing: "bg-surface text-muted",
  reviewing: "bg-surface text-muted",
  published: "bg-accent text-on-accent",
  closed: "bg-fg text-bg",
};

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
    <section aria-labelledby={`group-${index}`} className="flex flex-col gap-4 rounded-box bg-surface p-5">
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

// 게시 뒤에도 고칠 수 있는 칸(R-14, R-15)
function SettingsForm({ survey }: { survey: Survey }) {
  return (
    <details className="rounded-box bg-surface p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">소개글·공유 메시지·마감·목표 바꾸기</summary>
      <form action={saveSettings.bind(null, survey.id)} className="mt-3 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-medium">소개글</span>
          <textarea name="intro" rows={3} required defaultValue={survey.intro ?? ""} className="field py-2" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-medium">공유 메시지</span>
          <textarea name="share_message" rows={2} defaultValue={survey.share_message ?? ""} className="field py-2" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="font-medium">목표 응답 수</span>
            <input name="target_responses" type="number" min={1} required defaultValue={survey.target_responses ?? ""} className="field" />
          </label>
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
        </div>
        <SubmitButton pendingSteps={AI_STEPS.save}>저장</SubmitButton>
      </form>
    </details>
  );
}

// 응답 방식(ADR 0017 v2): 기본은 이메일 없이 바로 응답, 켜면 한 사람 한 번만(이메일 인증).
function ResponseModeForm({ survey }: { survey: Survey }) {
  return (
    <form action={saveResponseMode.bind(null, survey.id)} className="flex flex-col gap-3 rounded-box bg-surface p-4">
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="require_email" defaultChecked={survey.require_email} className="mt-1 size-5" />
        <span className="flex flex-col gap-1">
          <span className="font-medium">한 사람 한 번만 받기</span>
          <span className="text-sm text-muted break-keep">
            켜면 응답자가 이메일 인증번호를 받아야 응답할 수 있어요. 끄면 링크를 열자마자 바로 응답하고, 같은 브라우저에서만 두 번 응답을 막아요.
          </span>
        </span>
      </label>
      <SubmitButton pendingSteps={AI_STEPS.save} variant="secondary">
        응답 방식 저장
      </SubmitButton>
    </form>
  );
}

function DesignDetails({ survey }: { survey: Survey }) {
  return (
    <details className="rounded-box bg-surface p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">확인한 설계 보기</summary>
      <div className="mt-3">
        <ConfirmedSummary survey={survey} />
      </div>
    </details>
  );
}

function Body({
  survey,
  origin,
  canEdit,
  responses,
  stats,
  report,
}: {
  survey: Survey;
  origin: string;
  canEdit: boolean;
  responses: number;
  stats: QuestionStat[];
  report: ReportRow | null;
}) {
  const reportSection = (
    <ReportSection
      surveyId={survey.id}
      report={report}
      hypotheses={survey.hypotheses.map((h) => h.statement)}
      responseCount={responses}
      target={survey.target_responses}
      closed={survey.status === "closed"}
    />
  );
  const minutes = survey.target_minutes ?? 3;
  if (survey.status === "published" && survey.slug) {
    const link = `${origin}/s/${survey.slug}`;
    return (
      // 넓은 화면은 2단: 왼쪽은 보는 것(리포트·결과·문항), 오른쪽은 하는 것(공유·설정·마감)
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          {reportSection}
          <ResultsSection surveyId={survey.id} stats={stats} responseCount={responses} target={survey.target_responses} closesAt={survey.closes_at} live />
          <DesignDetails survey={survey} />
          <QuestionsSection surveyId={survey.id} questions={survey.questions} targetMinutes={minutes} editable={canEdit} />
        </div>
        <aside className="flex flex-col gap-6 lg:sticky lg:top-20 lg:order-none order-first">
          <ShareBox link={link} shareText={buildShareText(survey.share_message ?? "", link, minutes)} />
          <ResponseModeForm survey={survey} />
          <SettingsForm survey={survey} />
          {responses > 0 && <DeleteRequest surveyId={survey.id} />}
          <form action={closeNow.bind(null, survey.id)} className="flex flex-col gap-2">
            <p className="text-sm text-muted">목표 응답 수나 마감일에 닿으면 자동으로 마감돼요. 지금 끝내려면:</p>
            <SubmitButton variant="secondary" pendingSteps={["마감하는 중…"]}>
              지금 마감하기
            </SubmitButton>
          </form>
        </aside>
      </div>
    );
  }
  if (survey.status === "reviewing") {
    const ready = survey.questions.length > 0;
    return (
      <div className="flex flex-col gap-8">
        <DesignDetails survey={survey} />
        <QuestionsSection
          surveyId={survey.id}
          questions={survey.questions}
          targetMinutes={minutes}
          footer={
            ready && (
              <form action={publish.bind(null, survey.id)} className="flex flex-col gap-2 border-t border-line pt-6">
                <p className="text-sm text-muted">게시하면 공개 링크가 열리고 응답을 받기 시작해요. 응답이 들어오면 문항은 바꿀 수 없어요.</p>
                <SubmitButton pendingSteps={["게시하는 중…"]}>게시하기</SubmitButton>
              </form>
            )
          }
        />
        {ready && <ResponseModeForm survey={survey} />}
      </div>
    );
  }
  if (survey.status === "closed") {
    const reason = { target: "목표 응답 수에 닿아", deadline: "마감일이 지나", manual: "직접", archive: "보관하면서" }[survey.close_reason ?? ""] ?? "";
    return (
      <div className="flex flex-col gap-8">
        <p role="status" className="rounded-box bg-surface p-4">
          {reason} 마감했어요. 응답 {responses}개.
        </p>
        {reportSection}
        <ResultsSection surveyId={survey.id} stats={stats} responseCount={responses} target={survey.target_responses} closesAt={survey.closes_at} live={false} />
        {responses > 0 && <DeleteRequest surveyId={survey.id} />}
        <DesignDetails survey={survey} />
        <QuestionsSection surveyId={survey.id} questions={survey.questions} targetMinutes={minutes} editable={false} />
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

async function SurveyDesign({ params, searchParams }: PageProps<"/app/surveys/[id]">) {
  const { db, user } = await requireMember();
  await closeOverdue(createAdminClient()); // 마감일 지난 설문은 들어올 때 마감(R-16)
  const { id } = await params;
  const { error, moved } = await searchParams;
  const { data } = await db
    .from("surveys")
    .select("*, hypotheses(position, statement), questions(id, position, type, prompt, options, required, review_note)")
    .eq("id", id)
    .eq("owner_id", user.id) // RLS와 함께 두 곳에서 막는다(multi-user R-3)
    .order("position", { referencedTable: "hypotheses" })
    .order("position", { referencedTable: "questions" })
    .maybeSingle();
  if (!data) notFound();
  const survey = data as Survey;
  const service = createAdminClient();
  const canEdit = await canEditQuestions(service, survey);
  const results = survey.status === "published" || survey.status === "closed" ? await loadResults(db, survey.id) : null;
  const responses = results?.responseCount ?? 0;
  const report = results ? await latestReport(service, survey.id) : null;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <>
      {/* 머리: 지금 상태와 설문 제목(문제), 단계 막대 — 어디에 있는지 먼저 보이게(apple-design 길 찾기) */}
      <header className="mb-8 flex flex-col gap-3">
        <span className={`self-start rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_TONE[survey.status] ?? "bg-surface text-muted"}`}>
          {STATUS_LABEL[survey.status] ?? survey.status}
        </span>
        <h1 className="text-3xl leading-tight font-bold">{survey.problem}</h1>
        <StageBar current={stageOf(survey)} animate={moved === "1"} className="mt-2" />
      </header>
      {isDemoAi() && <DemoNotice />}
      {survey.taken_down_at && (
        // 운영자가 내린 설문(multi-user R-14) — 주인은 되돌릴 수 없다. 사유는 보이지 않는다.
        <p role="status" className="mb-6 rounded-box bg-danger-bg p-3 text-sm text-danger">
          운영자가 내린 설문이에요. 응답 링크가 응답을 받지 않아요.
        </p>
      )}
      {typeof error === "string" && (
        <p role="alert" className="mb-6 rounded-box bg-danger-bg p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Body survey={survey} origin={origin} canEdit={canEdit} responses={responses} stats={results?.stats ?? []} report={report} />
    </>
  );
}

export default function SurveyPage(props: PageProps<"/app/surveys/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link href="/app" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted hover:underline">
        ← 내 설문
      </Link>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <SurveyDesign {...props} />
      </Suspense>
    </main>
  );
}
