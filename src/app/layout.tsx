import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, Nanum_Gothic, Noto_Sans_KR } from "next/font/google";
import { Suspense } from "react";
import { LookSwitch } from "./look-switch";
import "./globals.css";

// 느낌 세트별 글꼴(디자인 2단계). 고른 뒤 하나만 남긴다.
const noto = Noto_Sans_KR({ variable: "--font-noto", weight: ["400", "500", "700"], preload: false });
const plex = IBM_Plex_Sans_KR({ variable: "--font-plex", weight: ["400", "500", "700"], preload: false });
const nanum = Nanum_Gothic({ variable: "--font-nanum", weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
  title: "서베이 파일럿",
  description: "풀고 싶은 문제 하나로 설문 설계부터 리포트까지",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${noto.variable} ${plex.variable} ${nanum.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        {process.env.NODE_ENV !== "production" && (
          <Suspense>
            <LookSwitch />
          </Suspense>
        )}
      </body>
    </html>
  );
}
