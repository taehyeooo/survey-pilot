"use client";

import { useActionState } from "react";
import { sendLoginLink, type LoginState } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendLoginLink, {});

  if (state.sent) {
    return (
      <p role="status" className="rounded-box bg-surface p-4 text-sm leading-6">
        <strong>{state.sent}</strong>로 로그인 링크를 보냈어요. 메일함에서 링크를 눌러 주세요.
      </p>
    );
  }

  const error = state.error ?? notice;
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "login-error" : undefined}
        className="field"
      />
      {error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-box bg-accent font-medium text-on-accent disabled:opacity-50"
      >
        {pending ? "보내는 중…" : "로그인 링크 받기"}
      </button>
    </form>
  );
}
