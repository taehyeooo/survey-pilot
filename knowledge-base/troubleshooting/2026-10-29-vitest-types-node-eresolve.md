---
title: create-next-app 직후 vitest 설치가 ERESOLVE로 실패
date: 2026-10-29
tags: [npm, vitest, next.js, "@types/node"]
related: ["#3"]
status: resolved
---

# create-next-app 직후 vitest 설치가 ERESOLVE로 실패

## 증상
`npm install -D vitest`가 `ERESOLVE could not resolve`로 실패. 리포트: `peerOptional @types/node@"^22.0.0 || >=24.0.0" from vitest@5.0.5`, 프로젝트에는 `@types/node@20.19.43`. 환경: Node 24.20.0, npm 11.19.0, create-next-app 16.4.3이 만든 package.json.

## 1단계: 왜 에러가 났나 (직접 원인)
create-next-app 템플릿이 `"@types/node": "^20"`을 넣는다. vitest 5는 `@types/node`를 선택적 peer로 22 이상만 받는다. 이미 설치된 20은 범위 밖이라 npm이 트리를 풀지 못했다.

## 2단계: 개념은 어떻게 동작하나
npm 7+는 peer 의존성을 자동 설치하고 범위가 안 맞으면 실패시킨다. `peerOptional`은 "없어도 되지만 있으면 이 범위여야 한다"는 뜻이라, 설치돼 있는 20이 충돌한다. `--legacy-peer-deps`·`--force`는 검사를 끄는 것이라 범위 밖 조합을 그대로 둔다.

## 3단계: 구조는 왜 이렇게 되어 있나
템플릿은 가장 넓게 맞는 오래된 Node 타입을 고르고, 실제 런타임(여기선 Node 24, CI도 24)과 맞추는 건 프로젝트 몫이다. 타입 버전이 런타임과 어긋나 있어서 새 도구의 peer 범위에 걸렸다.

## 해결
`npm install -D @types/node@^24 vitest` — 타입을 실제 런타임(Node 24)에 맞췄다. CI(`.github/workflows/web.yml`)도 Node 24로 고정해 로컬과 같게 했다. 검사 우회 플래그는 쓰지 않았다.

## 확인한 것 / 확인하지 않은 것
- 확인: 설치 성공, `npm test`·`npm run build`·`tsc --noEmit` 통과.
- 미확인: Vercel 배포 런타임의 Node 버전(16단계에서 24로 맞출 것).
