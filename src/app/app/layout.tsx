import { Suspense } from "react";
import { BareMarker } from "./shell-frame";
import { TopBar } from "./top-bar";

// 사용자 화면 뼈대: 상단 메뉴 바 + 넓은 본문(디자인 결정 30).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <>
      <TopBar />
      <Suspense>
        <BareMarker />
      </Suspense>
      {children}
    </>
  );
}
