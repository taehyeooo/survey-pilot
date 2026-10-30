"use client";

import { useEffect } from "react";

// 포인트 색 시안 전환(개발 서버에서만 — layout.tsx가 production에서는 그리지 않는다).
// ?variant=blue 로 고르고, 같은 탭에서 다른 화면으로 옮겨도 유지한다. ?variant=a 로 되돌린다(보라).
export function VariantSwitch() {
  useEffect(() => {
    const picked = new URLSearchParams(location.search).get("variant");
    try {
      if (picked) sessionStorage.setItem("variant", picked);
      const variant = picked ?? sessionStorage.getItem("variant");
      if (variant && variant !== "a") document.documentElement.dataset.variant = variant;
      else delete document.documentElement.dataset.variant;
    } catch {
      if (picked && picked !== "a") document.documentElement.dataset.variant = picked;
    }
  });
  return null;
}
