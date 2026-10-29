# troubleshooting — 근본 원인 기록

같은 문제를 두 번 겪지 않기 위해, 증상이 아니라 **원인과 구조**까지 남긴다.

- 양식: [docs/templates/troubleshooting.md](../../docs/templates/troubleshooting.md)
- 파일 이름: `YYYY-MM-DD-<증상-요약>.md`
- 세 단계를 모두 채운다: 왜 에러? → 개념은 어떻게 동작? → 구조는 왜 이렇게?
- 해결하면서 추가한 테스트·훅·CI를 적는다. 구조를 바꿨다면 ADR을 함께 남긴다.
- 원인을 다 못 찾았으면 `status: workaround` 또는 `open`. 모르는 것을 아는 척 쓰지 않는다.
- 새 문서를 쓰면 아래 목록에 한 줄을 더한다 — 없으면 `check_docs.py`가 실패시킨다(ADR 0009).

## 목록

| 날짜 | 문서 | 영역 |
|---|---|---|
| 2026-10-29 | [create-next-app 직후 vitest 설치 ERESOLVE](2026-10-29-vitest-types-node-eresolve.md) | npm·의존성 |
| 2026-10-29 | [Vitest에서 "@/..." import 실패](2026-10-29-vitest-at-alias.md) | 테스트·빌드 도구 |
| 2026-10-29 | [서버 컴포넌트에서 "use client" 파일의 상수가 undefined](2026-10-29-client-module-value-undefined.md) | Next.js·RSC |
