---
id: "0019"
title: 응답자 쪽은 DB에 직접 접근하지 않고 서버 라우트로만 읽고 쓴다
version: 1
status: active
superseded_by:
date: 2026-10-29
sources:
  - 2026-10-29 기획 인터뷰 사용자 답(ADR로 남기기 선택)
  - ../../docs/specs/2026-10-29-survey-pilot.md
---

# 0019 응답자 쪽은 DB에 직접 접근하지 않고 서버 라우트로만 읽고 쓴다

## 결정
- anon 키에는 어떤 테이블의 RLS 정책도 주지 않는다. 공개 설문 읽기·인증번호·제출은 모두 Next.js 서버 라우트가 service role로 처리한다.
- 관리자는 RLS로 자기 설문(`owner_id = auth.uid()` + JWT 이메일 = `ADMIN_EMAIL`)과 그 하위 행만 읽는다. 하위 테이블 쓰기는 서버만 한다.
- `verifications`·`usage_events`·`audit_logs`는 정책 없음(서버만).
- service role 키는 서버 코드에서만 쓰고 클라이언트 번들에 넣지 않는다.

## 확인 방법
- 테스트: `survey-pilot#R-31` — anon 클라이언트로 모든 테이블 select·insert 시 0행 또는 거부.
- 사람 리뷰: RLS 정책이나 마이그레이션을 바꾸는 PR, 클라이언트 코드에서 `SUPABASE_SERVICE_ROLE_KEY`를 참조하는지.

## 이유
- 인증번호 확인·필수 문항·선택지 값·목표 응답 수 잠금은 서버에서 반드시 거쳐야 한다. anon에 insert를 열면 이 검사를 건너뛴 쓰기가 가능해진다.
- RLS로 응답자 규칙까지 표현하면 정책이 복잡해지고, 실수 하나로 응답 전체가 읽힐 수 있다.

## 비교한 대안
1. anon에 published 설문 select·responses insert 정책 — 코드는 줄지만 검사를 우회할 수 있다.
2. 응답자도 Supabase Auth 사용자로(OTP) — 관리자 계정과 섞이고, Supabase 기본 메일 한도(시간당 약 2통)에 걸린다.

## 다시 볼 조건
- 응답자 화면을 클라이언트 실시간 기능(Realtime 등)으로 바꿀 때.
