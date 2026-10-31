"use client";

import { useActionState, useRef, useState } from "react";
import { Mascot } from "../../icons";
import { startSurvey, type StartState } from "../surveys/actions";
import { AI_STEPS } from "../ai-steps";
import { usePendingStep } from "../submit-button";

// 예시 문제 — 눌러서 칸에 채워 보고 고쳐 쓴다(빈 칸 앞에서 막히지 않게, 결정 36).
const EXAMPLES = [
  "주 2회 저녁 스터디의 출석률이 3개월째 떨어지는 이유",
  "동아리 회비를 제때 내지 않는 사람이 많은 이유",
  "학교 앞 카페에 오후 손님이 줄어든 이유",
];

// hero: 화면 가운데 크게(새 설문 화면). 목록 맨 위에서는 기본 크기.
export function ProblemForm({ hero = false }: { hero?: boolean }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startSurvey, {});
  const [length, setLength] = useState(state.problem?.trim().length ?? 0);
  const step = usePendingStep(pending, AI_STEPS.clarify);
  const field = useRef<HTMLTextAreaElement>(null);
  const fill = (text: string) => {
    if (!field.current) return;
    field.current.value = text;
    setLength(text.length);
    field.current.focus();
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      {hero ? (
        <div className="flex items-center gap-4">
          <Mascot className="size-14 shrink-0 rounded-box shadow-lg shadow-brand/20" />
          <label htmlFor="problem" className="text-2xl font-semibold tracking-title sm:text-3xl">
            어떤 문제를 풀고 싶나요?
          </label>
        </div>
      ) : (
        <label htmlFor="problem" className="font-medium">
          어떤 문제를 풀고 싶나요?
        </label>
      )}
      <p id="problem-hint" className="text-sm text-muted">
        누가, 언제, 무엇이 궁금한지 적을수록 질문이 줄어요.
      </p>
      <textarea
        ref={field}
        id="problem"
        name="problem"
        rows={hero ? 6 : 4}
        required
        minLength={10}
        maxLength={1000}
        defaultValue={state.problem}
        onChange={(e) => setLength(e.target.value.trim().length)}
        aria-describedby="problem-hint problem-count"
        aria-invalid={Boolean(state.error)}
        className={`field p-3 ${hero ? "text-lg leading-8" : "leading-6"}`}
      />
      {hero && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">이렇게 써 보세요</span>
          {EXAMPLES.map((text) => (
            <button key={text} type="button" onClick={() => fill(text)} className="min-h-11 rounded-full border border-line bg-bg px-4 text-sm hover:border-brand hover:text-brand">
              {text}
            </button>
          ))}
        </div>
      )}
      <p id="problem-count" className="text-right text-sm text-muted" aria-live="polite">
        {length.toLocaleString("ko-KR")} / 1,000자
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn btn-primary"
      >
        <span aria-live="polite">{pending ? step : "설문 설계 시작"}</span>
      </button>
    </form>
  );
}
