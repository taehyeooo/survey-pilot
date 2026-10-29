# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: http://localhost:3000/login 에서 관리자 매직링크 로그인 한 번 확인(5단계까지 머지됨)
2. plan 6단계: 문제 입력 → 되묻기 → 설계 제안 → 확인 ①(R-6~R-9, R-28) — 가짜 AI로 화면·흐름 먼저, 실제 프롬프트는 4단계 샘플 검증 뒤
3. plan 4단계(샘플 검증): **막힘 — Gemini 키, 사용자 샘플 문제 10개**

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), Gmail 앱 비밀번호(10단계 전), Vercel 연결(16단계 전)
