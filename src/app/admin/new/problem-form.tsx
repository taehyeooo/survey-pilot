"use client";

import { useActionState, useState } from "react";
import { startSurvey, type StartState } from "../surveys/actions";
import { AI_STEPS } from "../ai-steps";
import { usePendingStep } from "../submit-button";

// hero: 화면 가운데 크게(새 설문 화면). 목록 맨 위에서는 기본 크기.
export function ProblemForm({ hero = false }: { hero?: boolean }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startSurvey, {});
  const [length, setLength] = useState(state.problem?.trim().length ?? 0);
  const step = usePendingStep(pending, AI_STEPS.clarify);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="problem" className={hero ? "text-2xl font-semibold sm:text-3xl" : "font-medium"}>
        어떤 문제를 풀고 싶나요?
      </label>
      <p id="problem-hint" className="text-sm text-muted">
        누가, 언제, 무엇이 궁금한지 적을수록 질문이 줄어요. 예: 주 2회 저녁 스터디의 출석률이 3개월째 떨어지는 이유
      </p>
      <textarea
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
        className="min-h-11 rounded-box bg-accent font-medium text-on-accent disabled:opacity-60"
      >
        <span aria-live="polite">{pending ? step : "설문 설계 시작"}</span>
      </button>
    </form>
  );
}
