---
title: Supabase 로그인 메일이 "보내지 못했어요" — Gmail이 일반 비밀번호를 거절
version: 1
status: open
updated: 2026-10-30
sources:
  - 2026-10-30 Supabase Auth Logs(/otp 500)
---

# Supabase 로그인 메일이 "보내지 못했어요" — Gmail이 일반 비밀번호를 거절

## 증상
운영 주소에서 로그인(인증번호) 메일을 요청하면 화면에 "보내지 못했어요". Supabase Auth Logs에 `/otp` 500.

## 원인
로그 `error`: `534 5.7.9 Application-specific password required`. Supabase SMTP 설정의 Password에 Gmail **계정 비밀번호**가 들어가 있었다. 2단계 인증을 쓰는 Gmail은 외부 프로그램(SMTP)에 **앱 비밀번호 16자리**만 받는다.

## 고친 방법
Google 계정 → 보안 → 앱 비밀번호에서 만든 값(또는 `.env.local`의 `GMAIL_APP_PASSWORD`)을 Supabase → Authentication → Emails → SMTP Settings → Password에 넣고 저장(사람 손 — 비밀값).

## 찾는 법
화면 문구만으로는 원인이 안 보인다. Supabase 대시보드 → Logs → Auth에서 ERROR 줄을 열어 `error` 칸을 본다.
