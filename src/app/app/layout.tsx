import { Suspense } from "react";
import { BareMarker } from "./shell-frame";
import { SideBar } from "./side-bar";

// 사용자 화면 뼈대: 왼쪽 메뉴 + 넓은 본문(결정 37, 이전 결정 30 상단 메뉴 바).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="shell grid flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
      <SideBar />
      <Suspense>
        <BareMarker />
      </Suspense>
      <div className="flex min-w-0 flex-col">{children}</div>
    </div>
  );
}
