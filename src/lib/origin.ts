import type { NextRequest } from "next/server";

// 사용자가 실제로 연 주소(예: 127.0.0.1:3001, 배포 도메인). request.url은 개발 서버에서 localhost로
// 바뀌어 나와 쿠키가 다른 호스트로 가 버린다 — Host 헤더(프록시 뒤면 x-forwarded-host)를 쓴다.
export function originOf(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}
