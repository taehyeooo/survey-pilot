"use client";

import { useState } from "react";

// 되묻기 질문 하나의 선택지(결정 40) — 여러 개를 고를 수 있다. "직접 입력"도 그중 하나라 글 칸에 쓰면 저절로 골라진다.
// 하나도 안 골랐을 때만 required를 걸어 브라우저가 제출을 막는다(체크박스 묶음에는 묶음 required가 없다). 서버도 한 번 더 본다.
export function ClarifyChoices({ index, question, options }: { index: number; question: string; options: string[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (value: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  const required = picked.size === 0;
  const box = "flex min-h-11 items-center gap-3 rounded-box border border-line px-3 has-checked:border-brand has-checked:bg-accent-soft";
  return (
    <>
      {options.map((option) => (
        <label key={option} className={box}>
          <input type="checkbox" name={`answer-${index}`} value={option} required={required} onChange={(e) => toggle(option, e.target.checked)} />
          {option}
        </label>
      ))}
      <label className={`${box} focus-within:outline-2 focus-within:outline-accent`}>
        <input
          type="checkbox"
          name={`answer-${index}`}
          value="__other"
          required={required}
          checked={picked.has("__other")}
          onChange={(e) => toggle("__other", e.target.checked)}
        />
        <span className="shrink-0">직접 입력</span>
        <input
          name={`other-${index}`}
          aria-label={`${question} 직접 입력`}
          onInput={(e) => toggle("__other", e.currentTarget.value.trim() !== "")}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none"
        />
      </label>
    </>
  );
}
