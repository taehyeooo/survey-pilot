import { AI_STEPS } from "../../ai-steps";
import { IconBadge, IconList } from "../../../icons";
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
const toolBase = "min-h-11 rounded-box px-3 text-sm hover:bg-line/50 disabled:opacity-40";
const toolButton = `${toolBase} text-muted`;

function Preview({ question }: { question: Question }) {
  if (question.type === "text") return <div aria-hidden className="field h-20" />;
  if (question.type === "scale") {
    return (
      <div aria-hidden className="flex flex-col gap-1">
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="flex min-h-11 items-center justify-center rounded-box border border-line text-sm">
              {n}
            </span>
          ))}
        </div>
        {/* 응답자가 보는 양 끝 말과 같게(결정 41) */}
        <p className="flex justify-between gap-4 text-xs text-muted">
          <span>1 · {question.options[0]?.label ?? "전혀 아니다"}</span>
          <span className="text-right">5 · {question.options[1]?.label ?? "매우 그렇다"}</span>
        </p>
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

function QuestionCard({ surveyId, question, index, last, editable }: { surveyId: string; question: Question; index: number; last: boolean; editable: boolean }) {
  const fixed = isClosing(question);
  return (
    <li className="flex flex-col gap-3 card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">
          {index + 1}. {question.prompt}
          {!question.required && <span className="ml-1 text-sm font-normal text-muted">(선택)</span>}
        </p>
        <span className="shrink-0 text-xs text-muted">{fixed ? "고정" : TYPE_LABEL[question.type]}</span>
      </div>
      <Preview question={question} />
      {question.review_note && <p className="rounded-box bg-bg px-3 py-2 text-sm text-muted">자동으로 고침: {question.review_note}</p>}
      {!fixed && editable && (
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
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">종류</span>
                <select name="type" defaultValue={question.type} className="field">
                  {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">선택지 (고르기 문항만, 한 줄에 하나, 2개 이상)</span>
                <textarea name="options" rows={Math.max(3, question.options.length)} defaultValue={question.options.map((o) => o.label).join("\n")} className="field py-2" />
              </label>
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

export function QuestionsSection({
  surveyId,
  questions,
  targetMinutes,
  editable = true,
  footer,
}: {
  surveyId: string;
  questions: Question[];
  targetMinutes: number;
  editable?: boolean;
  footer?: React.ReactNode;
}) {
  if (questions.length === 0) {
    return (
      <form action={makeQuestions.bind(null, surveyId)} className="flex flex-col gap-3">
        <p className="text-muted">가설마다 문항을 만들고, 유도 질문·이중 질문·선택지 빠짐을 점검한 뒤 {targetMinutes}분 안으로 맞춰요.</p>
        <SubmitButton pendingSteps={AI_STEPS.questions}>문항 만들기</SubmitButton>
      </form>
    );
  }
  const seconds = estimateSeconds(questions);
  const movable = questions.filter((q) => !isClosing(q));
  return (
    <section id="questions" aria-labelledby="questions-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="questions-title" className="flex items-center gap-3 text-title">
          <IconBadge>
            <IconList className="size-5" />
          </IconBadge>
          문항 {questions.length}개
        </h2>
        <p className={`text-sm ${seconds > targetMinutes * 60 ? "text-danger" : "text-muted"}`}>
          예상 {Math.floor(seconds / 60)}분 {seconds % 60}초 · 목표 {targetMinutes}분
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <QuestionCard key={q.id} surveyId={surveyId} question={q} index={i} last={!isClosing(q) && q.id === movable.at(-1)?.id} editable={editable} />
        ))}
      </ol>
      {editable ? (
        <form action={appendQuestion.bind(null, surveyId)}>
          <button type="submit" className="min-h-11 w-full rounded-box border border-dashed border-line text-sm text-muted hover:bg-line/50">
            + 문항 추가
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">응답이 들어와 문항은 바꿀 수 없어요. 소개글·공유 메시지·마감일·목표 응답 수는 바꿀 수 있어요.</p>
      )}
      {footer}
    </section>
  );
}
