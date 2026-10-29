// 디자인 구조 시안(디자인 1단계) — 개발 서버에서만 ?ux=a|b|c 로 바꿔 본다.
// 화면 쪽 갈래는 `process.env.NODE_ENV !== "production" && ux === "b"`처럼 그 자리에서 직접 쓴다 —
// 다른 파일의 상수로 감싸면 번들러가 접지 못해 운영 빌드에 시안 코드가 남는다(빌드 결과로 확인함).
// 고른 뒤(3단계 적용) 이 파일과 고르지 않은 갈래를 지운다.
export type Ux = "a" | "b" | "c";

export function uxOf(raw: unknown): Ux {
  if (process.env.NODE_ENV === "production") return "a";
  return raw === "b" || raw === "c" ? raw : "a";
}

export function withUx(href: string, ux: Ux) {
  if (process.env.NODE_ENV === "production" || ux === "a") return href;
  return `${href}${href.includes("?") ? "&" : "?"}ux=${ux}`;
}
