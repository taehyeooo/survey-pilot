# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. plan 1단계: 프로젝트 뼈대(Next.js·Supabase 클라이언트·테스트·mock) — [plan](../docs/plans/2026-10-29-survey-pilot.md). 새 이슈·브랜치·워크트리로, 레포 루트 `.env.local`을 워크트리에 복사해 쓴다
2. plan 4단계 전에 샘플 문제 정의 30개 준비(사용자 10 + Claude 초안 20, 사용자 검토)

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역은 서울로 안내했으나 실제 선택 지역은 확인하지 않음

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `ADMIN_EMAIL`·`CONTACT_EMAIL`(5단계 전), Gmail 앱 비밀번호(10단계 전), Vercel 연결(16단계 전)
