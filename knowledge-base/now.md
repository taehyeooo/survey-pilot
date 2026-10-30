# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-30

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: Vercel 가입·`taehyeooo/survey-pilot` Import·환경변수(.env.local에서 SUPABASE_DB_URL 빼고, HASH_SECRET·CRON_SECRET은 로컬과 같은 값) → 배포 주소 알려 주기. 15단계까지 머지됨
2. plan 16단계: 배포 뒤 Supabase Auth Site URL·Redirect URL에 배포 주소, 실제 로그인·응답·크론 확인
3. plan 4단계(샘플 검증): 30개 실행·4차 재실행 끝([결과](../docs/samples/2026-10-30-run.md), Claude 판정 28/30) — **사용자 판정 필요**(기준 24/30), 남은 것: 리포트·주관식·주입 문장 검증(가짜 응답 25건), 거울상 가설(#11)·두 가지 묻기(#25)
4. 결정 필요: `CONTACT_EMAIL`. 디자인 작업 때 apple-design 스킬 설치 여부

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), Vercel 연결과 환경변수(16단계 전, `HASH_SECRET`은 로컬과 **같은 값**이어야 함 — 바꾸면 기존 해시와 안 맞음)
