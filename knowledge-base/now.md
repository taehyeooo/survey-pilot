# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: 3000에서 게시 → 본인 이메일로 응답 → 결과·리포트 확인. 13단계까지 머지됨
2. plan 4단계(샘플 검증): **막힘 — 사용자 샘플 문제 10개**. 되묻기·설계·문항·점검·리포트 프롬프트를 실제 Gemini로 검증할 차례(나머지 기능은 다 있음)
3. plan 14단계(응답 삭제 요청)·15단계(크론: 마감일 마감+최종 리포트, 이메일 원문 정리)·16단계(Vercel 배포)
4. 결정 필요: `CONTACT_EMAIL`. 디자인 작업 때 apple-design 스킬 설치 여부

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), , Vercel 연결과 환경변수(16단계 전, `HASH_SECRET`은 로컬과 **같은 값**이어야 함 — 바꾸면 기존 해시와 안 맞음)
