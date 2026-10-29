---
title: 로그인 뒤 다른 호스트(localhost)로 이동해 "관리자만" 오류
date: 2026-10-29
tags: [next.js, auth, cookies]
related: ["#21"]
status: resolved
---

# 로그인 뒤 다른 호스트(localhost)로 이동해 "관리자만" 오류

## 증상
`http://127.0.0.1:3001/auth/confirm?...`로 로그인했는데 `http://localhost:3001/login?error=forbidden`에 도착했다.

## 1단계: 왜 에러가 났나 (직접 원인)
인증 경로가 `new URL("/admin", request.url)`로 이동 주소를 만들었다. Next 개발 서버에서 `request.url`의 호스트는 사용자가 연 `127.0.0.1`이 아니라 `localhost`였다. 세션 쿠키는 127.0.0.1에 저장됐는데 localhost로 이동해, localhost에 있던 다른(실제 관리자) 세션으로 열렸다.

## 2단계: 개념은 어떻게 동작하나
쿠키는 포트가 아니라 **호스트 이름**으로 나뉜다. 서버가 아는 자기 주소(`request.url`)와 사용자가 연 주소(`Host` 헤더, 프록시 뒤면 `x-forwarded-host`)는 다를 수 있다.

## 3단계: 구조는 왜 이렇게 되어 있나
로그인 뒤 이동처럼 "사용자 브라우저가 다시 올 주소"는 사용자가 연 호스트여야 하는데, 서버 내부 주소를 썼다. 배포에서도 프록시 뒤라면 같은 일이 생길 수 있다.

## 해결
`src/lib/origin.ts` `originOf(request)` — Host·x-forwarded-* 헤더로 주소를 만든다. `/auth/callback`·`/auth/confirm`·`proxy.ts`가 쓴다. 테스트 `test/origin.test.ts`.

## 확인한 것 / 확인하지 않은 것
- 확인: 127.0.0.1·localhost 각각 요청한 호스트로 돌아감(curl), 단위 테스트 2개.
- 미확인: Vercel 배포에서의 헤더(16단계에서 실제 로그인으로 확인).
