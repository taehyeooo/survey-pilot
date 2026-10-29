import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "서베이 파일럿",
  description: "풀고 싶은 문제 하나로 설문 설계부터 리포트까지",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
