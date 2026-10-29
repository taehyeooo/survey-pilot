# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: http://localhost:3000 에서 써 보고 디자인 4단계 의견. 8단계(게시)까지 머지됨
2. plan 9단계: 응답 화면(Tally 스타일)·동의·honeypot·IP 제한·마감/404 안내(R-17, R-3, R-4, R-20) — `/s/[slug]`가 지금은 "준비 중"
3. plan 4단계(샘플 검증): **막힘 — 사용자 샘플 문제 10개**
4. 결정 필요: 공개 링크 HTTP 404(지금은 200+noindex+404 화면) — Proxy에서 DB 확인할지

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), , Vercel 연결(16단계 전)
