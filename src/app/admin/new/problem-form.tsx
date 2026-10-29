"use client";

import { useActionState, useState } from "react";
import { startSurvey, type StartState } from "../surveys/actions";
import type { Ux } from "../ux";

// hero: 화면 가운데 크게(시안 C의 새 설문). ux는 숨은 칸으로 보내 돌아올 때 시안을 유지한다.
export function ProblemForm({ ux = "a", hero = false }: { ux?: Ux; hero?: boolean }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startSurvey, {});
  const [length, setLength] = useState(state.problem?.trim().length ?? 0);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="ux" value={ux} />
      <label htmlFor="problem" className={hero ? "text-2xl font-semibold break-keep sm:text-3xl" : "font-medium"}>
        어떤 문제를 풀고 싶나요?
      </label>
      <p id="problem-hint" className="text-sm text-zinc-500 break-keep">
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
        className={`rounded-lg border border-zinc-300 bg-transparent p-3 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100 ${hero ? "text-lg leading-8" : "leading-6"}`}
      />
      <p id="problem-count" className="text-right text-sm text-zinc-500" aria-live="polite">
        {length.toLocaleString("ko-KR")} / 1,000자
      </p>
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="h-11 rounded-lg bg-zinc-900 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "AI가 문제를 살펴보는 중…" : "설문 설계 시작"}
      </button>
    </form>
  );
}
