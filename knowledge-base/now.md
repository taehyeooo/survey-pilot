# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: 3000에서 설문 게시 → 공개 링크에서 본인 이메일로 인증·응답 끝까지(실제 Gmail 확인). 11단계(제출)까지 머지됨
2. plan 12단계: 진행 현황·문항별 집계·차트·CSV(R-21, R-22, R-25)
3. plan 4단계(샘플 검증): **막힘 — 사용자 샘플 문제 10개**
4. 결정 필요: `CONTACT_EMAIL`(응답자 삭제 요청 연락처, 공개됨)

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), , Vercel 연결과 환경변수(16단계 전, `HASH_SECRET`은 로컬과 **같은 값**이어야 함 — 바꾸면 기존 해시와 안 맞음)
