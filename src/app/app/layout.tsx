import { Suspense } from "react";
import { BareMarker } from "./shell-frame";
import { TopBar } from "./top-bar";

// 사용자 화면 뼈대: 상단 메뉴 바 + 넓은 본문(디자인 결정 30). 맨 위에 첫 화면과 같은 옅은 파스텔 빛(결정 36).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="relative isolate flex flex-1 flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 hero-glow" />
      <TopBar />
      <Suspense>
        <BareMarker />
      </Suspense>
      {children}
    </div>
  );
}
