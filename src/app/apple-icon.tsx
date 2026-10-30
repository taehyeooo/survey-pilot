import { ImageResponse } from "next/og";

// 홈 화면 추가용 아이콘(180px PNG) — 웹 아이콘(icon.svg)과 같은 그림: 파랑 둥근 사각형 + 올라가는 막대 셋.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bar = (height: number) => ({ width: 17, height, borderRadius: 9, background: "#ffffff" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 17, paddingBottom: 45, background: "#1d4ed8" }}>
        <div style={bar(45)} />
        <div style={bar(96)} />
        <div style={bar(68)} />
      </div>
    ),
    size,
  );
}
