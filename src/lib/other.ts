// "기타" 선택지와 그 글(결정 41) — 응답 화면(클라이언트)과 서버가 함께 쓰므로 가벼운 파일에 둔다.
// 기타 글은 선택지 id 배열에 "text:글"로 함께 저장한다 — 집계는 id만 세므로 그대로 두고, 글은 따로 모은다.
export const OTHER_TEXT_MAX = 200;
export const OTHER_PREFIX = "text:";
export const isOtherLabel = (label: string) => /^기타(\s|\(|$)/.test(label.trim());
export const otherTextOf = (value: unknown) =>
  Array.isArray(value) ? (value.map(String).find((v) => v.startsWith(OTHER_PREFIX))?.slice(OTHER_PREFIX.length) ?? null) : null;
