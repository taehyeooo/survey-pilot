"use client";

import { useState } from "react";

// 공개 링크와 공유 메시지(링크·소요 시간 포함, R-15) 복사.
export function ShareBox({ link, shareText }: { link: string; shareText: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(what: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("실패");
    }
  }
  const base = "btn text-sm";
  return (
    <section aria-labelledby="share-title" className="card flex flex-col gap-3 p-6">
      <h2 id="share-title" className="text-lg font-semibold">
        응답 받는 중 — 링크를 공유하세요
      </h2>
      <p className="card px-3 py-2 text-sm break-all">{link}</p>
      <pre className="card px-3 py-2 font-sans text-sm whitespace-pre-wrap">{shareText}</pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("링크", link)} className={`${base} btn-secondary`}>
          링크 복사
        </button>
        <button type="button" onClick={() => copy("공유 메시지", shareText)} className={`${base} btn-primary`}>
          공유 메시지 복사
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {copied === "실패" ? "복사하지 못했어요. 위 글을 직접 선택해 복사해 주세요." : copied ? `${copied}를 복사했어요.` : ""}
      </p>
    </section>
  );
}
