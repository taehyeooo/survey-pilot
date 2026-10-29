"use client";

import { useRef } from "react";

// "직접 입력" — 글 칸을 누르거나 쓰면 이 선택지가 골라진다(안 그러면 글을 써도 선택 안 됨 오류가 난다).
export function OtherOption({ index, question }: { index: number; question: string }) {
  const radio = useRef<HTMLInputElement>(null);
  const pick = () => {
    if (radio.current) radio.current.checked = true;
  };
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-zinc-200 px-3 dark:border-zinc-800">
      <input ref={radio} type="radio" name={`answer-${index}`} value="__other" required />
      <span className="shrink-0">직접 입력</span>
      <input
        name={`other-${index}`}
        aria-label={`${question} 직접 입력`}
        onFocus={pick}
        onInput={pick}
        className="min-w-0 flex-1 bg-transparent py-2 outline-none"
      />
    </label>
  );
}
