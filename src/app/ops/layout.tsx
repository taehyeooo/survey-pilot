import { SideBar } from "../app/side-bar";

// 운영 페이지도 같은 왼쪽 메뉴를 쓴다 — 운영 안의 개요·사용자·설문·삭제 요청은 OpsNav 탭.
export default function OpsLayout({ children }: LayoutProps<"/ops">) {
  return (
    <div className="shell grid flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
      <SideBar />
      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
