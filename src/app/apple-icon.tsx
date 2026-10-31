import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// 홈 화면 추가용 아이콘(180px PNG) — 웹 아이콘(icon.svg)의 캐릭터(비행쪽지)를 그대로 키워 그린다(결정 37). 그림은 한 곳(icon.svg)에만 둔다.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8");
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      // 휴대폰이 모서리를 직접 둥글게 자르므로 바탕을 꽉 채운다(투명 모서리는 검게 보인다)
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#6254d9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
