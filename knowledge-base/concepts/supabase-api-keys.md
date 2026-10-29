---
title: Supabase API 키와 DB 접속
version: 1
status: active
updated: 2026-10-29
sources:
  - https://supabase.com/docs/guides/api/api-keys
  - 2026-10-29 실측: 이 프로젝트의 두 키로 Auth API 요청 시 모두 200
---

# Supabase API 키 — 공개 키와 비밀 키

## 무엇
Supabase 프로젝트에는 URL 하나와 키 두 종류가 있다. 대시보드 Project Settings → API Keys에서 찾는다.

| 대시보드 이름 (예전 / 새) | 이 레포 변수 | 성격 |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | 공개 |
| `anon` / Publishable (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 — 브라우저에 노출돼도 된다. RLS 정책이 허락한 것만 할 수 있다 |
| `service_role` / Secret (`sb_secret_…`) | `SUPABASE_SERVICE_ROLE_KEY` | **비밀** — RLS를 무시한다. 서버 코드에서만 |

Supabase가 키 이름을 새 방식으로 바꾸는 중이라 대시보드에 둘 다 보이거나 한쪽만 보일 수 있다. 이 프로젝트는 2026-10-29 기준 새 방식 키를 쓴다(두 키 모두 동작 확인).

## 이 레포에서
- anon 키에는 어떤 테이블 정책도 주지 않는다. 응답자 쪽은 서버 라우트가 비밀 키로 처리한다([ADR 0019](../decisions/0019-respondents-via-server-only.md)).
- `NEXT_PUBLIC_` 접두사가 붙은 값은 Next.js가 클라이언트 번들에 넣는다. 그래서 비밀 키에는 절대 붙이지 않는다.
- 값은 레포 루트 `.env.local`(git 무시)과 Vercel 환경변수에만 둔다. 채팅·로그에 출력하지 않는다.
- DB 비밀번호는 앱이 쓰지 않는다. 마이그레이션 때 Supabase CLI 연결에만 쓴다.

## DB 접속(마이그레이션)
- 앱은 DB 비밀번호를 쓰지 않는다. 마이그레이션 적용에만 `SUPABASE_DB_URL`을 쓴다: `npx supabase db push --db-url "$SUPABASE_DB_URL"`(먼저 `--dry-run`).
- 주소는 대시보드 Connect → **Session pooler**(포트 5432). Direct connection은 IPv6 전용이라 IPv4 망에서 안 될 수 있다. 이 프로젝트는 `aws-0-ap-northeast-2.pooler.supabase.com`(서울, 2026-10-29 접속 확인).
- 비밀번호의 특수문자는 퍼센트 인코딩한다.
- Docker가 없어 로컬 Supabase는 쓰지 않는다. DB 테스트(`test/db`)는 실제 프로젝트에 대고 돌고, 만든 사용자·행은 끝나면 지운다. CI에는 키가 없어 건너뛴다 — `describe.skipIf`여도 describe 본문은 실행되므로 클라이언트는 `beforeAll`에서 만들고, PR 전에 `.env.local` 없이 한 번 돌려 본다(PR #8에서 CI만 실패했던 원인).
