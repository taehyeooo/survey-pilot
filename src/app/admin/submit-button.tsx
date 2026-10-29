"use client";

import { useFormStatus } from "react-dom";

// AI를 부르는 폼은 몇 초 걸린다 — 누르는 동안 막고 무엇을 하는지 보여 준다.
export function SubmitButton({
  children,
  pendingText,
  formAction,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingText: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "border border-zinc-300 dark:border-zinc-700";
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      aria-busy={pending}
      className={`h-11 rounded-lg px-4 font-medium disabled:opacity-50 ${style}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
