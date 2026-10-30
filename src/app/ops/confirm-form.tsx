import { SubmitButton } from "@/app/app/submit-button";

// 운영 조치의 사유·확인 칸(ADR 0012). 미리보기는 이 폼 위에 화면이 그린다.
export function ConfirmForm({ action, label, danger }: { action: (formData: FormData) => Promise<void>; label: string; danger?: boolean }) {
  return (
    <form action={action} className="flex flex-col gap-3 card p-4">
      <label htmlFor="reason" className="text-sm font-medium">
        사유
      </label>
      <textarea id="reason" name="reason" required rows={3} className="field" placeholder="감사 기록에 남아요. 본인에게는 보이지 않아요." />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="confirm" required className="size-5" />
        위 내용을 확인했어요
      </label>
      <SubmitButton pendingSteps={["처리하는 중…"]} variant={danger ? "primary" : "secondary"}>
        {label}
      </SubmitButton>
    </form>
  );
}

export function Result({ done, error }: { done?: string | string[]; error?: string | string[] }) {
  if (typeof error === "string")
    return (
      <p role="alert" className="rounded-box bg-danger-bg p-3 text-sm text-danger">
        {error}
      </p>
    );
  if (done === "1")
    return (
      <p role="status" className="card p-3 text-sm">
        처리했어요. 감사 기록에 남겼어요.
      </p>
    );
  return null;
}
