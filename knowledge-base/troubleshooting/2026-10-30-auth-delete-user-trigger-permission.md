---
title: Auth 사용자 삭제가 "Database error deleting user"
date: 2026-10-30
tags: [supabase, auth, rls, trigger]
related: ["#49"]
status: resolved
---

# Auth 사용자 삭제가 "Database error deleting user"

## 증상
`auth.admin.deleteUser(id)`가 `AuthRetryableFetchError: Database error deleting user`(500). 그 사용자가 설문(문항 포함)을 가진 경우에만. 설문이 없거나, 같은 삭제를 `postgres` 역할로 SQL에서 하면 성공한다.

## 1단계: 왜 에러가 났나 (직접 원인)
여러 사용자 마이그레이션에서 `auth.users → profiles → surveys → questions`로 `on delete cascade`를 이었다. 문항이 지워질 때 `design_lock` 트리거(응답이 있으면 문항 변경 금지)가 `surveys`·`responses`를 select한다. 그 트리거는 호출한 역할 권한으로 도는데, 삭제를 실행한 `supabase_auth_admin`은 public 테이블 select 권한이 없다(`has_table_privilege` → false).

## 2단계: 개념은 어떻게 동작하나
Supabase Auth API는 자기 역할(`supabase_auth_admin`)로 `auth.users`를 지운다. 외래 키 cascade 자체는 테이블 소유자 권한으로 처리되지만, cascade로 지워지는 행의 일반 트리거는 `security invoker`(기본)면 호출자 권한으로 돈다. 그래서 cascade가 public 쪽 트리거를 건드리는 순간 권한 오류가 난다. Supabase 오류 메시지는 내부 원인을 감추고 "Database error"만 준다.

## 3단계: 구조는 왜 이렇게 되어 있나
1인용일 때는 설문 주인이 `auth.users`를 cascade 없이 가리켜 계정 삭제가 public 트리거까지 닿지 않았다. 탈퇴 즉시 삭제(ADR 0020)로 cascade를 이으며 처음 드러났다.

## 해결
`supabase/migrations/20261030000001_auth_delete_cascade.sql` — `design_lock`을 `security definer set search_path = public`로(검사 내용은 그대로, anon·authenticated 실행 권한 회수). 테스트 `test/db/multi-user.test.ts`의 "Auth 사용자를 지우면…".

## 확인한 것 / 확인하지 않은 것
- 확인: 적용 뒤 전체 테스트 146개 통과, 원인은 `has_table_privilege('supabase_auth_admin', 'public.surveys', 'select') = false`로 확인.
- 미확인: 응답이 있는 설문을 가진 사용자 삭제(트리거가 "부모가 이미 없음"으로 통과하는 경로)는 탈퇴 단계(plan 10)에서 테스트한다.
- 앞으로: auth.users에서 cascade로 닿는 public 테이블에 트리거를 더하면 같은 일이 생긴다 — 트리거가 다른 테이블을 읽으면 security definer로.
