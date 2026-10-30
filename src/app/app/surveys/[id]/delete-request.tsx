"use client";

import { useActionState } from "react";
import { deleteForRequest, findForDeletion, type DeletionState } from "../actions";

// 응답 삭제 요청(R-26): 이메일로 찾기 → 미리보기 → 사유 + 되돌릴 수 없음 확인 → 삭제. 이메일은 URL에 넣지 않는다.
const kstFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

function ConfirmStep({ surveyId, state, reset }: { surveyId: string; state: DeletionState; reset: () => void }) {
  const preview = state.preview!;
  const [result, action, pending] = useActionState<DeletionState, FormData>(deleteForRequest.bind(null, surveyId, preview.respondentId), state);
  if (result.step === "done") {
    return (
      <p role="status" className="card p-3 text-sm">
        응답을 지우고 기록을 남겼어요. 집계와 CSV에서 빠졌어요.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <dl className="card p-3 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted">이메일</dt>
          <dd>{state.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">제출</dt>
          <dd>{kstFormat.format(new Date(preview.submittedAt))}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">답</dt>
          <dd>{preview.answers}개</dd>
        </div>
      </dl>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">삭제 사유</span>
        <input name="reason" required placeholder="예: 응답자 본인 요청(10/30 메일)" className="field" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="size-4" />
        이 응답을 지우면 되돌릴 수 없어요.
      </label>
      {result.error && (
        <p role="alert" className="text-sm text-danger">
          {result.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-box border border-danger px-4 text-sm font-medium text-danger disabled:opacity-60">
          {pending ? "지우는 중…" : "응답 지우기"}
        </button>
        <button type="button" onClick={reset} className="min-h-11 rounded-box px-4 text-sm text-muted hover:bg-line/50">
          취소
        </button>
      </div>
    </form>
  );
}

export function DeleteRequest({ surveyId }: { surveyId: string }) {
  const [state, action, pending] = useActionState<DeletionState, FormData>(findForDeletion.bind(null, surveyId), { step: "search" });
  return (
    <details className="card p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">응답 삭제 요청 처리</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-muted">응답자가 자기 응답을 지워 달라고 하면 이메일로 찾아 지워요. 지운 사람·시각·사유는 기록으로 남아요.</p>
        {state.step === "confirm" && state.preview ? (
          <ConfirmStep key={state.preview.respondentId} surveyId={surveyId} state={state} reset={() => location.reload()} />
        ) : (
          <form action={action} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">응답자 이메일</span>
              <input name="email" type="email" required defaultValue={state.email} className="field" />
            </label>
            {state.error && (
              <p role="alert" className="text-sm text-danger">
                {state.error}
              </p>
            )}
            <button type="submit" disabled={pending} className="min-h-11 self-start rounded-box border border-line px-4 text-sm font-medium hover:bg-line/50 disabled:opacity-60">
              {pending ? "찾는 중…" : "응답 찾기"}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
