"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

// 단계 문구(ai-steps.ts)를 2초마다 바꾸고 마지막 문구에서 멈춘다.

export function usePendingStep(pending: boolean, steps: string[]) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, steps.length - 1)), 2000);
    return () => {
      clearInterval(timer);
      setIndex(0);
    };
  }, [pending, steps.length]);
  return steps[index];
}

export function SubmitButton({
  children,
  pendingSteps,
  formAction,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingSteps: string[];
  formAction?: (formData: FormData) => void | Promise<void>;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const step = usePendingStep(pending, pendingSteps);
  const style = { primary: "bg-accent text-on-accent", secondary: "border border-line", ghost: "text-sm text-muted hover:bg-surface" }[variant];
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
      className={`min-h-11 rounded-box px-4 font-medium disabled:opacity-60 ${style}`}
    >
      <span aria-live="polite">{pending ? step : children}</span>
    </button>
  );
}
