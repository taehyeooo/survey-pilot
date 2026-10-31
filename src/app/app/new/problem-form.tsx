"use client";

import { useActionState, useRef, useState } from "react";
import { IconArrowRight, PaperPilot } from "../../icons";
import { startSurvey, type StartState } from "../surveys/actions";
import { AI_STEPS } from "../ai-steps";
import { usePendingStep } from "../submit-button";

// 예시 문제 — 눌러서 칸에 채워 보고 고쳐 쓴다(빈 칸 앞에서 막히지 않게, 결정 36·37).
const EXAMPLES = [
  "주 2회 저녁 스터디의 출석률이 3개월째 떨어지는 이유",
  "동아리 회비를 제때 내지 않는 사람이 많은 이유",
  "학교 앞 카페에 오후 손님이 줄어든 이유",
];

export function ProblemForm() {
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
      <div className="flex items-center gap-3 self-start rounded-box border border-line bg-accent-soft px-3 py-2.5">
        <PaperPilot size={36} motion="float" />
        <div>
          <label htmlFor="problem" className="block text-sm font-semibold">
            어떤 답을 찾고 있나요?
          </label>
          <p id="problem-hint" className="text-xs text-muted">
            완벽한 문장보다 지금 떠오르는 고민을 적어 주세요. 누가, 언제, 무엇이 궁금한지 적을수록 질문이 줄어요.
          </p>
        </div>
      </div>
      <div className="rounded-box border border-line bg-bg shadow-sm focus-within:border-accent focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent">
        <textarea
          ref={field}
          id="problem"
          name="problem"
          rows={4}
          required
          minLength={10}
          maxLength={1000}
          defaultValue={state.problem}
          onChange={(e) => setLength(e.target.value.trim().length)}
          aria-describedby="problem-hint problem-count"
          aria-invalid={Boolean(state.error)}
          placeholder="동아리 회비를 제때 내지 않는 사람이 많은 이유"
          className="block w-full resize-none rounded-box bg-transparent px-4 pt-4 text-lg leading-8 outline-none"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <p id="problem-count" className="pl-1 text-sm text-muted tabular-nums" aria-live="polite">
            {length.toLocaleString("ko-KR")} / 1,000자
          </p>
          <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
            <span aria-live="polite">{pending ? step : "설계 시작"}</span>
            {!pending && <IconArrowRight className="size-4" />}
          </button>
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">예시</span>
        {EXAMPLES.map((text) => (
          <button key={text} type="button" onClick={() => fill(text)} className="min-h-11 rounded-box border border-line bg-bg px-3 text-sm text-muted hover:border-brand hover:text-brand">
            {text}
          </button>
        ))}
      </div>
    </form>
  );
}
