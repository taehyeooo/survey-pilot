# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. plan 4단계: 샘플 검증(ADR 0003) — 실제 Gemini 클라이언트 + 되묻기·설계·생성·점검·리포트 프롬프트를 샘플 30개로. 3단계(한도 가드)까지 머지됨. **막힘: Gemini 키, 사용자 샘플 문제 10개** — Claude 초안 20개는 먼저 만들 수 있음
2. 4단계를 기다리는 동안 5단계(관리자 로그인·목록)를 먼저 할 수 있음 — `ADMIN_EMAIL` 필요

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `ADMIN_EMAIL`·`CONTACT_EMAIL`(5단계 전), Gmail 앱 비밀번호(10단계 전), Vercel 연결(16단계 전)
