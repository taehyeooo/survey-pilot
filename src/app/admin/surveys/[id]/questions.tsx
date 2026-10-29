import { AI_STEPS } from "../../ai-steps";
import { SubmitButton } from "../../submit-button";
import { estimateSeconds, isClosing, type QuestionType } from "@/lib/questions";
import { appendQuestion, makeQuestions, moveDown, moveUp, remakeQuestion, removeQuestion, saveQuestion } from "../actions";

// 문항 미리보기·편집(R-13). 미리보기는 응답자 화면 모양 그대로, 편집은 문항마다 펼쳐서.
export interface Question {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: { id: string; label: string }[];
  required: boolean;
  review_note: string | null;
}

const TYPE_LABEL: Record<QuestionType, string> = { single: "하나 고르기", multi: "여러 개 고르기", scale: "1~5 척도", text: "주관식" };
const toolBase = "min-h-11 rounded-box px-3 text-sm hover:bg-surface disabled:opacity-40";
const toolButton = `${toolBase} text-muted`;

function Preview({ question }: { question: Question }) {
  if (question.type === "text") return <div aria-hidden className="field h-20 bg-surface" />;
  if (question.type === "scale") {
    return (
      <div aria-hidden className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="flex min-h-11 items-center justify-center rounded-box border border-line text-sm">
            {n}
          </span>
        ))}
      </div>
    );
  }
  return (
    <ul aria-hidden className="flex flex-col gap-2">
      {question.options.map((o) => (
        <li key={o.id} className="flex min-h-11 items-center gap-3 rounded-box border border-line px-3 text-sm">
          <span className={`size-4 shrink-0 border border-muted ${question.type === "single" ? "rounded-full" : "rounded"}`} />
          {o.label}
        </li>
      ))}
    </ul>
  );
}

function QuestionCard({ surveyId, question, index, last }: { surveyId: string; question: Question; index: number; last: boolean }) {
  const fixed = isClosing(question);
  const choice = question.type === "single" || question.type === "multi";
  return (
    <li className="flex flex-col gap-3 rounded-box border border-line p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {index + 1}. {question.prompt}
          {!question.required && <span className="ml-1 text-sm font-normal text-muted">(선택)</span>}
        </p>
        <span className="shrink-0 text-xs text-muted">{fixed ? "고정" : TYPE_LABEL[question.type]}</span>
      </div>
      <Preview question={question} />
      {question.review_note && <p className="rounded-box bg-surface px-3 py-2 text-sm text-muted">자동으로 고침: {question.review_note}</p>}
      {!fixed && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2">
          <form action={moveUp.bind(null, surveyId, question.id)}>
            <button type="submit" disabled={index === 0} aria-label={`${index + 1}번 문항 위로`} className={toolButton}>
              ↑ 위로
            </button>
          </form>
          <form action={moveDown.bind(null, surveyId, question.id)}>
            <button type="submit" disabled={last} aria-label={`${index + 1}번 문항 아래로`} className={toolButton}>
              ↓ 아래로
            </button>
          </form>
          <form action={remakeQuestion.bind(null, surveyId, question.id)}>
            <SubmitButton variant="ghost" pendingSteps={AI_STEPS.question}>
              다시 만들기
            </SubmitButton>
          </form>
          <form action={removeQuestion.bind(null, surveyId, question.id)}>
            <button type="submit" className={`${toolBase} text-danger`}>
              삭제
            </button>
          </form>
          <details className="w-full">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">수정</summary>
            <form action={saveQuestion.bind(null, surveyId, question.id)} className="mt-2 flex flex-col gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">문항</span>
                <textarea name="prompt" rows={2} required defaultValue={question.prompt} className="field py-2" />
              </label>
              {choice && (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-medium">선택지 (한 줄에 하나, 2개 이상)</span>
                  <textarea name="options" rows={Math.max(3, question.options.length)} required defaultValue={question.options.map((o) => o.label).join("\n")} className="field py-2" />
                </label>
              )}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="required" defaultChecked={question.required} className="size-4" />
                꼭 답해야 하는 문항
              </label>
              <SubmitButton pendingSteps={AI_STEPS.save}>저장</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </li>
  );
}

export function QuestionsSection({ surveyId, questions, targetMinutes }: { surveyId: string; questions: Question[]; targetMinutes: number }) {
  if (questions.length === 0) {
    return (
      <form action={makeQuestions.bind(null, surveyId)} className="flex flex-col gap-3">
        <p className="text-muted">가설마다 문항을 만들고, 유도 질문·이중 질문·선택지 빠짐을 점검한 뒤 {targetMinutes}분 안으로 맞춰요.</p>
        <SubmitButton pendingSteps={AI_STEPS.questions}>문항 만들기</SubmitButton>
      </form>
    );
  }
  const seconds = estimateSeconds(questions);
  const editable = questions.filter((q) => !isClosing(q));
  return (
    <section id="questions" aria-labelledby="questions-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="questions-title" className="text-lg font-semibold">
          문항 {questions.length}개
        </h2>
        <p className={`text-sm ${seconds > targetMinutes * 60 ? "text-danger" : "text-muted"}`}>
          예상 {Math.floor(seconds / 60)}분 {seconds % 60}초 · 목표 {targetMinutes}분
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <QuestionCard key={q.id} surveyId={surveyId} question={q} index={i} last={!isClosing(q) && q.id === editable.at(-1)?.id} />
        ))}
      </ol>
      <form action={appendQuestion.bind(null, surveyId)}>
        <button type="submit" className="min-h-11 w-full rounded-box border border-dashed border-line text-sm text-muted hover:bg-surface">
          + 문항 추가
        </button>
      </form>
      <p className="text-sm text-muted">문항을 확인했으면 다음 단계에서 게시해요(공개 링크·공유 문구).</p>
    </section>
  );
}
