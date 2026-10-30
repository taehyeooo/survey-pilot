"use client";

import { useActionState } from "react";
import { deleteOpsDeletion, findOpsDeletion, type OpsDeletionState } from "../actions";

// 응답 삭제 요청(multi-user R-15): 이메일로 찾기 → 설문 제목·건수 미리보기 → 사유 + 되돌릴 수 없음 확인 → 삭제.
// 운영자는 답·제출 시각을 보지 않는다(ADR 0020). 이메일은 URL에 넣지 않는다.
function ConfirmStep({ state }: { state: OpsDeletionState }) {
  const [result, action, pending] = useActionState<OpsDeletionState, FormData>(deleteOpsDeletion, state);
  if (result.step === "done") {
    return (
      <p role="status" className="rounded-box bg-surface p-3 text-sm">
        응답 {result.deleted}건을 지우고 설문마다 기록을 남겼어요.
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="rounded-box bg-surface p-3 text-sm">
        <p className="break-all">
          <span className="text-muted">이메일</span> {state.email}
        </p>
        <p className="mt-2 text-muted">응답한 설문 {state.surveys?.length}개</p>
        <ul className="mt-1 list-disc pl-5">
          {state.surveys?.map((title, i) => (
            <li key={i} className="break-keep">
              {title}
            </li>
          ))}
        </ul>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">삭제 사유</span>
        <input name="reason" required placeholder="예: 응답자 본인 요청(10/30 메일)" className="field" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="size-4" />
        이 응답들을 지우면 되돌릴 수 없어요.
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
        <button type="button" onClick={() => location.reload()} className="min-h-11 rounded-box px-4 text-sm text-muted hover:bg-surface">
          취소
        </button>
      </div>
    </form>
  );
}

export function OpsDeletionForm() {
  const [state, action, pending] = useActionState<OpsDeletionState, FormData>(findOpsDeletion, { step: "search" });
  if (state.step === "confirm") return <ConfirmStep state={state} />;
  return (
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
      <button type="submit" disabled={pending} className="min-h-11 self-start rounded-box border border-line px-4 text-sm font-medium hover:bg-surface disabled:opacity-60">
        {pending ? "찾는 중…" : "응답 찾기"}
      </button>
    </form>
  );
}
