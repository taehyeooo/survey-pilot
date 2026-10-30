import { TopBar } from "../app/top-bar";

// 운영 페이지도 같은 상단 메뉴 바를 쓴다 — 운영 안의 개요·사용자·설문·삭제 요청은 OpsNav 탭.
export default function OpsLayout({ children }: LayoutProps<"/ops">) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
