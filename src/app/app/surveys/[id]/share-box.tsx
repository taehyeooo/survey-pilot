"use client";

import { useState } from "react";
import { IconBadge, IconLink } from "../../../icons";

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
      <h2 id="share-title" className="flex items-center gap-3 text-lg font-semibold">
        <IconBadge>
          <IconLink className="size-5" />
        </IconBadge>
        링크를 공유하세요
      </h2>
      {/* 같은 링크가 두 번 보여 헷갈리지 않게 칸마다 이름을 붙이고, 복사 버튼을 그 칸 옆에 둔다(결정 39) */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">응답 링크</p>
        <div className="flex gap-2">
          <p className="min-w-0 flex-1 truncate rounded-box border border-line bg-surface px-3 py-2.5 text-sm" title={link}>
            {link}
          </p>
          <button type="button" onClick={() => copy("링크", link)} className={`${base} btn-secondary shrink-0`}>
            복사
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">보낼 메시지 미리보기</p>
        <pre className="rounded-box border border-line bg-surface px-3 py-2.5 font-sans text-sm leading-6 break-all whitespace-pre-wrap">{shareText}</pre>
        <button type="button" onClick={() => copy("공유 메시지", shareText)} className={`${base} btn-primary`}>
          메시지 복사
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {copied === "실패" ? "복사하지 못했어요. 위 글을 직접 선택해 복사해 주세요." : copied ? `${copied}를 복사했어요.` : ""}
      </p>
    </section>
  );
}
