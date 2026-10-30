"use client";

import { useEffect, useRef } from "react";

// 축하 폭죽(결정 35) — 설문을 게시했을 때, 응답을 보냈을 때 한 번. 라이브러리 없이 Web Animations API로.
// 움직임 줄이기 설정이면 아무것도 하지 않는다(apple-design §14). 누르는 것을 가리지 않게 pointer-events 없음.
const COLORS = ["var(--brand)", "#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"];
const PIECES = 90;

export function Confetti() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = box.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // 실행마다 자기 묶음(layer)을 만들고 자기 것만 지운다 — 앞선 실행의 "끝나면 비우기"가 다음 실행의 조각을 지우지 않게
    const layer = document.createElement("div");
    root.appendChild(layer);
    const width = innerWidth;
    const animations = Array.from({ length: PIECES }, (_, i) => {
      const piece = document.createElement("span");
      const size = 6 + Math.random() * 6;
      piece.style.cssText = `position:absolute;top:-16px;left:${Math.random() * 100}%;width:${size}px;height:${size * 0.45}px;border-radius:2px;background:${COLORS[i % COLORS.length]};`;
      layer.appendChild(piece);
      const drift = (Math.random() - 0.5) * width * 0.25;
      const fall = innerHeight * (0.7 + Math.random() * 0.4);
      const spin = (Math.random() - 0.5) * 1080;
      return piece.animate(
        [
          { transform: "translate3d(0, 0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate3d(${drift}px, ${fall}px, 0) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1600 + Math.random() * 1200, delay: Math.random() * 250, easing: "cubic-bezier(0.2, 0.6, 0.3, 1)", fill: "forwards" },
      );
    });
    const remove = () => layer.remove();
    Promise.all(animations.map((a) => a.finished)).then(remove, remove); // 끝나면 화면에 남지 않게
    return () => {
      animations.forEach((a) => a.cancel());
      remove();
    };
  }, []);

  return <div ref={box} aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden" />;
}
