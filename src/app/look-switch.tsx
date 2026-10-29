"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

// 디자인 2단계 느낌 세트 — 개발 서버에서만 ?look=1|2|3 을 html[data-look]에 반영한다(이동해도 유지).
// 고른 뒤(3단계 적용) 이 파일을 지우고 고른 세트를 :root 기본값으로 둔다.
export function LookSwitch() {
  const look = useSearchParams().get("look");
  useEffect(() => {
    if (look === "1" || look === "2" || look === "3") {
      document.documentElement.dataset.look = look;
      sessionStorage.setItem("look", look);
    } else {
      const saved = sessionStorage.getItem("look");
      if (saved) document.documentElement.dataset.look = saved;
    }
  }, [look]);
  return null;
}
