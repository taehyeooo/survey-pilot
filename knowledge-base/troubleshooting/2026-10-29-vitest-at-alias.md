---
title: Vitest에서 "@/..." import가 Cannot find package로 실패
date: 2026-10-29
tags: [vitest, vite, tsconfig, next.js]
related: ["#7"]
status: resolved
---

# Vitest에서 "@/..." import가 Cannot find package로 실패

## 증상
`src/lib/ai.ts`의 `import ... from "@/lib/usage"`가 `npm run build`·`tsc`는 통과하는데 `vitest run`에서만 `Error: Cannot find package '@/lib/usage'`. 같은 때 Vite 경고: "ESM syntax in a file loaded as CommonJS (vitest.config.ts)".

## 1단계: 왜 에러가 났나 (직접 원인)
`@/*` 별칭은 `tsconfig.json`의 `paths`에만 있다. Vitest(Vite)는 기본으로 tsconfig `paths`를 읽지 않아서 `@/lib/usage`를 npm 패키지 이름으로 찾았다.

## 2단계: 개념은 어떻게 동작하나
- `tsconfig` `paths`는 타입 검사기용 정보다. 실제 모듈 해석은 각 번들러가 한다 — Next는 tsconfig `paths`를 읽어 별칭을 풀고, Vite는 `resolve.alias`(또는 플러그인)로 따로 받는다.
- `package.json`에 `"type": "module"`이 없으면 `.ts` 설정 파일은 CommonJS로 취급되어 Vite가 경고한다. `.mts`면 ESM으로 읽는다.

## 3단계: 구조는 왜 이렇게 되어 있나
create-next-app은 Next만 기준으로 별칭을 만든다. 테스트 러너는 뒤에 붙인 도구라 별칭을 모른다. 1단계 테스트는 상대 경로만 썼기 때문에 드러나지 않았다.

## 해결
`vitest.config.ts` → `vitest.config.mts`로 바꾸고 `resolve.alias`에 `"@": ./src`를 적었다. CI 경로 필터도 새 파일 이름으로.

## 확인한 것 / 확인하지 않은 것
- 확인: `npm test` 35개 통과, 경고 사라짐, build·tsc 통과.
- 미확인: Vite의 tsconfig paths 자동 지원 옵션 여부(쓰지 않음).
