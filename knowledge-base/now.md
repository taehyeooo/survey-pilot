# 지금 상태 (인계 메모)

새 세션은 이 파일부터 읽는다. **고쳐 쓰는 문서**다 — 끝난 일은 지우고, 자세한 내용은 [log.md](log.md)·PR·plan에 둔다(ADR 0015).

마지막 갱신: 2026-10-30

## 진행 중

## 승인 대기

## 다음 할 일
1. 사람 손: Supabase SMTP Password를 Gmail **앱 비밀번호**로 다시 넣기(지금 값은 Gmail이 거절 — [원인](troubleshooting/2026-10-30-gmail-smtp-app-password.md)), 메일 양식 "Confirm sign up"·"Reset password"에 `{{ .Token }}`(인증번호) 넣기
2. 여러 사용자 [plan](../docs/plans/2026-10-30-multi-user.md) 13단계 운영 확인: 두 번째 계정 가입(인증번호) → 설문 게시 → 응답 → 리포트, 운영자로 정지·해제. 12단계(비밀번호 로그인)까지 머지됨. 운영자 계정은 비밀번호가 없어 "비밀번호를 잊었어요"로 처음 정한다
3. 그다음: 앱 전체 디자인 다시(느낌 시안부터, apple-design — 사용자 2026-10-30 "일단 돌아가게 만들고 디자인은 다시")
4. plan 4단계(샘플 검증): 문항 30개(Claude 판정 29/30)·리포트(3/3) 끝 — [결과](../docs/samples/2026-10-30-run.md). **사용자 판정이 남음**(기준 24/30) — 판정하면 4단계 체크. 결정 필요: 서로 반대인 가설의 중복 문항(#11) — 그대로(편집에서 지움) 또는 문항-가설 다대다 구조
5. 결정 필요: `CONTACT_EMAIL`(Vercel에도 아직 없음) — 여러 사용자 11단계 전
6. 운영 크론(KST 00:10) 첫 실행 결과는 다음 날 Vercel 로그에서 확인

## 정해 둔 것
- 결정 사항 1~26: [spec](../docs/specs/2026-10-29-survey-pilot.md) "결정 사항", [PRD](../docs/specs/2026-10-29-survey-pilot-prd.md), ADR 0017~0019. 여러 사용자 결정: [spec](../docs/specs/2026-10-30-multi-user.md) 7장, ADR 0020
- Supabase 프로젝트 생성·키 3개를 레포 루트 `.env.local`에 넣음, 두 키 동작 확인(2026-10-29). 지역 서울(ap-northeast-2) 확인, 마이그레이션용 `SUPABASE_DB_URL`도 `.env.local`에

## 답이 필요한 것 (사람 손)
- 여러 사용자 13단계 전: Supabase SMTP 앱 비밀번호 다시, 메일 양식 `{{ .Token }}` (Rate Limits는 30통으로 됨)
- `CONTACT_EMAIL` 정하기 → `.env.local`과 Vercel 환경변수에 넣기

## 운영
- 주소 https://survey-pilot-gilt.vercel.app (Vercel Hobby, 서울 icn1). Supabase Auth Site URL은 운영 주소, Redirect URL은 운영·localhost 둘 다(2026-10-30)
