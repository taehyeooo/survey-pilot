"use client";

import { useActionState, useEffect, useState } from "react";
import { CODE_TTL_SECONDS } from "@/lib/auth-flow";
import { authAction, type AuthMode, type AuthState } from "./actions";

// 로그인·가입·인증번호·비밀번호 재설정(multi-user R-1). 단계는 서버 응답(state.mode)을 따르고,
// 로그인↔가입↔재설정 전환만 화면에서 바꾼다.
// notice는 오류(빨강), info는 알림(탈퇴 완료 등) — 알림을 오류처럼 보이지 않게 나눈다.
const TITLES: Record<AuthMode, string> = {
  login: "로그인",
  signup: "가입하기",
  verify: "인증번호 확인",
  forgot: "비밀번호 재설정",
  reset: "새 비밀번호",
};
const SUBMITS: Record<AuthMode, [string, string]> = {
  login: ["로그인", "확인하는 중…"],
  signup: ["인증번호 받기", "보내는 중…"],
  verify: ["가입 마치기", "확인하는 중…"],
  forgot: ["인증번호 받기", "보내는 중…"],
  reset: ["비밀번호 바꾸기", "바꾸는 중…"],
};
const linkButton = "inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:underline";

// 인증번호 남은 시간(1초마다). 0이 되면 확인 버튼을 막고 다시 받게 한다.
function useSecondsLeft(sentAt: number | undefined) {
  // 처음에는 보낸 시각으로 본다(3:00) — 미리 렌더링 중에 현재 시각을 읽지 않는다(Cache Components).
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!sentAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  if (!sentAt) return null;
  return Math.max(0, CODE_TTL_SECONDS - Math.floor((Math.max(now, sentAt) - sentAt) / 1000));
}

export function LoginForm({ notice, info }: { notice?: string; info?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, { mode: "login" });
  const [picked, setPicked] = useState<{ mode: AuthMode; from: AuthState } | null>(null);
  // 서버가 새 단계를 주면 그것을, 그 뒤 사용자가 전환을 누르면 그것을 쓴다.
  const mode = picked && picked.from === state ? picked.mode : state.mode;
  const switchTo = (next: AuthMode) => setPicked({ mode: next, from: state });
  const fresh = mode !== state.mode;
  const error = fresh ? undefined : (state.error ?? (mode === "login" ? notice : undefined));
  const message = fresh ? undefined : (state.info ?? (mode === "login" ? info : undefined));
  const codeStep = mode === "verify" || mode === "reset";
  const secondsLeft = useSecondsLeft(codeStep && !fresh ? state.codeSentAt : undefined);
  const expired = secondsLeft === 0;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="intent" value={mode} />
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{TITLES[mode]}</h2>
      {message && (
        <p role="status" className="rounded-box bg-surface p-3 text-sm">
          {message}
        </p>
      )}
      <label htmlFor="email" className="text-sm font-medium">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete={mode === "signup" ? "email" : "username"}
        required
        readOnly={codeStep}
        defaultValue={state.email}
        key={`email-${mode}`}
        className="field read-only:text-muted"
      />
      {codeStep && (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="code" className="text-sm font-medium">
              메일로 받은 인증번호 6자리
            </label>
            {secondsLeft !== null && (
              <span className={`text-sm tabular-nums ${expired ? "text-danger" : "text-muted"}`} aria-live={secondsLeft <= 30 ? "polite" : "off"}>
                {expired ? "시간이 지났어요" : `남은 시간 ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
              </span>
            )}
          </div>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required className="field tracking-[0.3em]" />
        </>
      )}
      {(mode === "login" || mode === "signup" || mode === "reset") && (
        <>
          <label htmlFor="password" className="text-sm font-medium">
            {mode === "reset" ? "새 비밀번호" : "비밀번호"}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "login" ? undefined : 8}
            required
            aria-describedby={mode === "login" ? undefined : "password-help"}
            className="field"
          />
          {mode !== "login" && (
            <span id="password-help" className="text-sm text-muted">
              8자 이상
            </span>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {expired && (
        <p role="alert" className="text-sm text-danger">
          인증번호 시간이 지났어요. 아래 &ldquo;인증번호 다시 받기&rdquo;를 눌러 주세요.
        </p>
      )}
      <button type="submit" disabled={pending || expired} className={`h-11 rounded-box bg-accent font-medium text-on-accent disabled:opacity-50`}>
        {pending ? SUBMITS[mode][1] : SUBMITS[mode][0]}
      </button>
      <div className="flex flex-wrap gap-x-4">
        {mode === "login" && (
          <>
            <button type="button" onClick={() => switchTo("signup")} className={linkButton}>
              처음이면 가입하기
            </button>
            <button type="button" onClick={() => switchTo("forgot")} className={linkButton}>
              비밀번호를 잊었어요
            </button>
          </>
        )}
        {codeStep && (
          <button type="submit" name="intent" value={mode === "verify" ? "resend" : "forgot"} formNoValidate className={linkButton}>
            인증번호 다시 받기
          </button>
        )}
        {mode !== "login" && (
          <button type="button" onClick={() => switchTo("login")} className={linkButton}>
            로그인으로 돌아가기
          </button>
        )}
      </div>
    </form>
  );
}
