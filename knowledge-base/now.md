# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-29

## 진행 중

## 승인 대기

## 다음 할 일
1. 사용자: Supabase 메일 한도가 풀리면 이 PC 같은 브라우저에서 로그인 → 디자인 4단계 의견. 7단계(문항)까지 머지됨
2. plan 8단계: 게시(slug 링크·확인 ②)·공유 문구·응답 후 수정 제한 화면(R-13 마무리, R-14, R-15)
3. plan 4단계(샘플 검증): **막힘 — 사용자 샘플 문제 10개**. Gemini 키 있음(gemini-3.8-flash 503 과부하였음)
4. (선택) Supabase 메일을 Gmail SMTP로 — 로그인 메일 한도, 10단계 준비

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- Gemini 키·AI Studio 실제 한도(4단계 전), 샘플 문제 10개(4단계 전), `CONTACT_EMAIL`(9단계 전), 배포 때 Supabase Auth Site URL·Redirect URL에 배포 주소 추가(16단계), Gmail 앱 비밀번호(10단계 전), Vercel 연결(16단계 전)
