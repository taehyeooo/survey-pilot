import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 디자인 결정 28 — 본문 글꼴 Noto Sans KR. 한글 글리프가 커서 미리 받지 않는다(preload: false).
const noto = Noto_Sans_KR({ variable: "--font-body", weight: ["400", "500", "700"], preload: false });

export const metadata: Metadata = {
  title: "서베이 파일럿",
  description: "풀고 싶은 문제 하나로 설문 설계부터 리포트까지",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${noto.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
