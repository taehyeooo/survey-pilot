---
title: 서버 컴포넌트에서 "use client" 파일의 상수가 undefined
date: 2026-10-29
tags: [next.js, react-server-components]
related: ["#13"]
status: resolved
---

# 서버 컴포넌트에서 "use client" 파일의 상수가 undefined

## 증상
조사 설계 화면에서 `TypeError: Cannot read properties of undefined (reading 'length')` — `usePendingStep(pending, steps)`의 `steps`가 undefined. `tsc`·`next build`·테스트는 모두 통과했고, 화면을 열어야 드러났다(Next 16.4.3).

## 1단계: 왜 에러가 났나 (직접 원인)
문구 목록 `AI_STEPS`를 `"use client"` 파일(`submit-button.tsx`)에서 내보내고, 서버 컴포넌트인 페이지가 그 값을 가져와 `pendingSteps={AI_STEPS.design}`로 넘겼다. 서버에서 그 값은 undefined였다.

## 2단계: 개념은 어떻게 동작하나
`"use client"`는 "여기부터 클라이언트 번들" 경계다. 서버 컴포넌트가 그 파일을 import하면 실제 모듈 대신 **클라이언트 참조**를 받는다. 참조는 컴포넌트로 렌더하는 데만 쓸 수 있고, 일반 값(객체·배열·함수)을 서버 코드에서 읽으면 실제 값이 아니다. 타입은 실제 모듈을 기준으로 맞으니 `tsc`가 잡지 못한다.

## 3단계: 구조는 왜 이렇게 되어 있나
버튼(클라이언트)과 문구(데이터)를 한 파일에 두었다. 데이터는 서버·클라이언트 양쪽에서 쓰는데 클라이언트 경계 안에 들어가 버렸다.

## 해결
문구를 `"use client"` 없는 `src/app/admin/ai-steps.ts`로 옮기고 양쪽에서 가져온다. 규칙: **"use client" 파일은 컴포넌트·훅만 내보낸다. 공용 상수·타입이 아닌 값은 따로 둔다.**

## 확인한 것 / 확인하지 않은 것
- 확인: 화면을 다시 열어 오류 없음, 대기 문구 버튼 동작.
- 미확인: 이런 실수를 잡는 린트 규칙(찾지 않음) — 화면 단계마다 실제 브라우저로 한 번 여는 것으로 막는다.
