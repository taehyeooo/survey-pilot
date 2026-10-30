"use client";

// 결과 보고서를 인쇄하거나 PDF로 저장(브라우저 인쇄 창에서 "PDF로 저장").
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-11 rounded-box border border-line px-4 text-sm font-medium hover:bg-surface">
      인쇄·PDF로 저장
    </button>
  );
}
