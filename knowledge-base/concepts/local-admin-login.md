---
title: 로컬에서 관리자 화면 확인하기
version: 1
status: active
updated: 2026-10-29
sources:
  - 2026-10-29 실측: 6단계 화면 확인에 이 방법을 씀(PR #12)
  - https://supabase.com/docs/guides/auth/server-side
---

# 로컬에서 관리자 화면 확인하기

## 왜
관리자 로그인은 매직링크(메일)다. 화면을 확인할 때마다 실제 관리자 메일함을 쓰면 Supabase 기본 메일 한도(시간당 몇 통)를 쓰고, 에이전트는 메일을 열 수 없다.

## 어떻게
1. 테스트 관리자 링크 만들기 — `@example.com` 주소만 받는다.
   ```bash
   node --env-file=.env.local scripts/dev_login_link.mjs test-e2e-admin@example.com 3001
   ```
2. 그 포트의 서버만 테스트 계정을 관리자로 본다(환경변수가 `.env.local`보다 우선).
   ```bash
   ADMIN_EMAIL=test-e2e-admin@example.com npm run dev -- --port 3001
   ```
3. 출력된 링크의 `localhost`를 **`127.0.0.1`로 바꿔** 브라우저로 연다 → `/auth/confirm`이 `verifyOtp(token_hash)`로 세션을 만들고 `/admin`으로 보낸다.
   - 쿠키는 포트가 아니라 호스트 이름으로 나뉜다. `localhost:3001`로 열면 `localhost:3000`의 실제 관리자 세션을 덮어써 로그아웃시킨다(2026-10-29 겪을 뻔함).
   - `127.0.0.1`에서 개발용 JS를 받으려면 `next.config.ts`의 `allowedDevOrigins`에 있어야 한다 — 없으면 화면은 보이지만 하이드레이트가 안 돼 버튼 클릭(복사 등)이 동작하지 않는다(폼은 서버 액션이라 동작해서 헷갈린다).
4. 끝나면 정리한다(계정·설문·admins 행). 서버는 PID로 끈다.
   ```bash
   node --env-file=.env.local scripts/dev_login_link.mjs --cleanup test-e2e-admin@example.com
   ```

## 알아 둘 것
- 3000 포트(메인 체크아웃)는 실제 `ADMIN_EMAIL`로 둔다 — 하나뿐인 자원은 한 작업에서만(CLAUDE.md).
- `GEMINI_API_KEY`가 없으면 개발 서버는 데모 AI(정해 둔 답, 문구에 `[데모]`)를 쓴다. 배포(production)에서는 쓰지 않는다(`src/lib/ai-runtime.ts`).
- 기본 매직링크는 PKCE라 링크를 요청한 브라우저에서만 열린다. 메일 템플릿 링크를 `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`로 바꾸면 다른 기기에서도 열린다(대시보드 Authentication → Email Templates, 사람이 할 일).
