# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-30

## 진행 중

## 승인 대기

## 다음 할 일
1. 여러 사용자 [plan](../docs/plans/2026-10-30-multi-user.md) 10단계: 탈퇴(미리보기 → 확인 글자 → Auth 사용자까지 삭제 → 감사 기록, 운영자 탈퇴 거부) — 9단계(응답 삭제 요청)까지 머지됨. [spec](../docs/specs/2026-10-30-multi-user.md), ADR 0020. 화면 단계(11)는 apple-design 스킬
2. plan 4단계(샘플 검증): 문항 30개(Claude 판정 29/30)·리포트(3/3) 끝 — [결과](../docs/samples/2026-10-30-run.md). **사용자 판정이 남음**(기준 24/30) — 판정하면 4단계 체크. 결정 필요: 서로 반대인 가설의 중복 문항(#11) — 그대로(편집에서 지움) 또는 문항-가설 다대다 구조
3. 결정 필요: `CONTACT_EMAIL`(Vercel에도 아직 없음) — 여러 사용자 11단계 전
4. 운영 크론(KST 00:10) 첫 실행 결과는 다음 날 Vercel 로그에서 확인

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019. 여러 사용자 결정: [spec](../docs/specs/2026-10-30-multi-user.md) 7장, ADR 0020
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- 여러 사용자 12단계 전: Supabase SMTP에 Gmail·앱 비밀번호, Auth Rate Limits 로그인 메일 시간당 30통
- `CONTACT_EMAIL` 정하기 → `.env.local`과 Vercel 환경변수에 넣기

## 운영
- 주소 https://survey-pilot-gilt.vercel.app (Vercel Hobby, 서울 icn1). Supabase Auth Site URL은 운영 주소, Redirect URL은 운영·localhost 둘 다(2026-10-30)
