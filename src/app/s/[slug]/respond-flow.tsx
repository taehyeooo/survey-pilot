"use client";

import { startTransition, useActionState, useState } from "react";
import { consentNotes } from "@/lib/consent-copy";
import { checkCode, sendCode, startAnswering, submitAnswers, type CodeState, type SubmitState, type VerifyState } from "./actions";

// 응답 흐름(R-17): 동의·이메일(R-3) → 인증번호(R-18) → 문항 → 제출(R-19).
export interface PublicQuestion {
  id: string;
  position: number;
  type: "single" | "multi" | "scale" | "text";
  prompt: string;
  options: { id: string; label: string }[];
  required: boolean;
}

const button = "min-h-11 w-full rounded-box bg-accent font-medium text-on-accent disabled:opacity-60";

function EmailStep({ slug, contact, state, action, pending }: { slug: string; contact: string | null; state: CodeState; action: (f: FormData) => void; pending: boolean }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 card p-4 text-sm leading-6">
        <legend className="sr-only">개인정보 수집·이용 동의</legend>
        <p>
          <strong>수집 항목</strong> 이메일 · <strong>목적</strong> 한 사람이 한 번만 응답하도록 확인 · <strong>보관</strong> 설문 마감 30일 뒤 삭제
        </p>
        {consentNotes(contact).map((note) => (
          <p key={note}>{note}</p>
        ))}
        <label className="mt-1 flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" name="consent" required className="size-5" />
          위 내용에 동의해요
        </label>
      </fieldset>
      <label className="flex flex-col gap-2">
        <span className="font-medium">이메일</span>
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className="field" aria-describedby="email-help" />
        <span id="email-help" className="text-sm text-muted">
          인증번호를 보내 드려요. 한 사람이 한 번만 응답할 수 있어요.
        </span>
      </label>
      {/* 봇만 채우는 숨은 칸(R-4) — 사람에게는 보이지 않고 읽히지도 않는다 */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending} className={button}>
        {pending ? "보내는 중…" : "인증번호 받기"}
      </button>
      <input type="hidden" name="slug" value={slug} />
    </form>
  );
}

// 바로 응답(ADR 0017 v2): 이메일 없이 안내 동의만 받고 문항으로.
function ConsentStep({ contact, state, action, pending }: { contact: string | null; state: VerifyState; action: (f: FormData) => void; pending: boolean }) {
  if (state.done) {
    return (
      <p role="status" className="card p-4">
        {state.error}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 card p-4 text-sm leading-6">
        <legend className="sr-only">응답 안내 동의</legend>
        <p>
          <strong>수집 항목</strong> 없음(이메일을 받지 않아요) · 같은 브라우저에서 두 번 응답하지 않도록 브라우저에 표시만 남겨요
        </p>
        {consentNotes(contact, { anonymous: true }).map((note) => (
          <p key={note}>{note}</p>
        ))}
        <label className="mt-1 flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" name="consent" required className="size-5" />
          위 내용에 동의해요
        </label>
      </fieldset>
      {/* 봇만 채우는 숨은 칸(R-4) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending} className={button}>
        {pending ? "준비하는 중…" : "응답 시작"}
      </button>
    </form>
  );
}

function CodeStep({ email, state, action, pending, resend }: { email: string; state: VerifyState; action: (f: FormData) => void; pending: boolean; resend: () => void }) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm">
        <strong>{email}</strong>로 인증번호 6자리를 보냈어요. 10분 안에 입력해 주세요.
      </p>
      <label className="flex flex-col gap-2">
        <span className="font-medium">인증번호</span>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="field text-center text-lg tracking-code"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending} className={button}>
        {pending ? "확인하는 중…" : "확인"}
      </button>
      <button type="button" onClick={resend} className="min-h-11 text-sm text-muted underline">
        이메일을 바꾸거나 인증번호 다시 받기
      </button>
    </form>
  );
}

function QuestionField({ q, index }: { q: PublicQuestion; index: number }) {
  const legend = (
    <legend className="mb-3 font-medium">
      {index + 1}. {q.prompt}
      {!q.required && <span className="ml-1 text-sm font-normal text-muted">(선택)</span>}
    </legend>
  );
  if (q.type === "text") {
    return (
      <fieldset>
        {legend}
        <textarea name={q.id} rows={3} required={q.required} aria-label={q.prompt} className="field w-full py-2" />
      </fieldset>
    );
  }
  if (q.type === "scale") {
    return (
      <fieldset>
        {legend}
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex min-h-11 cursor-pointer items-center justify-center rounded-box border border-line has-[:checked]:border-accent has-[:checked]:bg-surface has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
              <input type="radio" name={q.id} value={n} required={q.required} className="sr-only" />
              {n}
            </label>
          ))}
        </div>
        <p className="mt-1 flex justify-between text-xs text-muted">
          <span>전혀 아니다</span>
          <span>매우 그렇다</span>
        </p>
      </fieldset>
    );
  }
  return (
    <fieldset className="flex flex-col gap-2">
      {legend}
      {q.options.map((o) => (
        <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-box border border-line px-3 has-[:checked]:border-accent has-[:checked]:bg-surface">
          <input type={q.type === "single" ? "radio" : "checkbox"} name={q.id} value={o.id} required={q.type === "single" && q.required} className="size-4" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function QuestionsStep({ slug, token, questions, verified = false }: { slug: string; token: string; questions: PublicQuestion[]; verified?: boolean }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitAnswers.bind(null, slug, token), {});
  const [localError, setLocalError] = useState<string | null>(null);

  if (state.done) {
    return (
      <p role="status" className="card p-6 text-center leading-7">
        {state.error ?? "응답을 보냈어요. 참여해 주셔서 고마워요."}
      </p>
    );
  }

  // 폼 action으로 보내면 오류 뒤 폼이 비워진다 — 직접 보내서 입력한 답을 지킨다.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const missing = questions.findIndex((q) => q.type === "multi" && q.required && data.getAll(q.id).length === 0);
    if (missing >= 0) return setLocalError(`${missing + 1}번 문항에서 하나 이상 골라 주세요.`);
    setLocalError(null);
    startTransition(() => action(data));
  }

  const error = localError ?? state.error;
  return (
    <form className="flex flex-col gap-8" onSubmit={onSubmit}>
      <p role="status" className="card p-3 text-sm">
        {verified ? "이메일을 확인했어요. 이제 답해 주세요." : "이제 답해 주세요."}
      </p>
      {questions.map((q, i) => (
        <QuestionField key={q.id} q={q} index={i} />
      ))}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} aria-busy={pending} className={button}>
        {pending ? "보내는 중…" : "응답 보내기"}
      </button>
    </form>
  );
}

export function RespondFlow(props: { slug: string; questions: PublicQuestion[]; contact: string | null; requireEmail: boolean }) {
  return props.requireEmail ? <EmailFlow {...props} /> : <DirectFlow {...props} />;
}

function DirectFlow({ slug, questions, contact }: { slug: string; questions: PublicQuestion[]; contact: string | null }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(startAnswering.bind(null, slug), {});
  if (state.token) return <QuestionsStep slug={slug} token={state.token} questions={questions} />;
  return <ConsentStep contact={contact} state={state} action={action} pending={pending} />;
}

function EmailFlow({ slug, questions, contact }: { slug: string; questions: PublicQuestion[]; contact: string | null }) {
  const [codeState, codeAction, codePending] = useActionState<CodeState, FormData>(sendCode.bind(null, slug), { step: "email" });
  const email = codeState.email ?? "";
  const [verifyState, verifyAction, verifyPending] = useActionState<VerifyState, FormData>(checkCode.bind(null, slug, email), {});

  if (verifyState.token) return <QuestionsStep slug={slug} token={verifyState.token} questions={questions} verified />;
  if (codeState.step === "code") {
    return <CodeStep email={email} state={verifyState} action={verifyAction} pending={verifyPending} resend={() => location.reload()} />;
  }
  return <EmailStep slug={slug} contact={contact} state={codeState} action={codeAction} pending={codePending} />;
}
