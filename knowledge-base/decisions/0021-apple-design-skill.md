---
id: "0021"
title: 화면 디자인 작업에 apple-design 스킬(emilkowalski/skills)을 쓴다
version: 1
status: active
superseded_by:
date: 2026-10-30
sources:
  - 2026-10-30 사용자 말("디자인 부분은 내가 저번에 말했던 애플 디자인 스킬 사용해줘", 설치 허락 "응 진행해줘" — #69)
  - https://github.com/emilkowalski/skills/tree/main/skills/apple-design (MIT, SKILL.md 하나)
---

# 0021 화면 디자인 작업에 apple-design 스킬을 쓴다

## 결정
- 화면을 만들거나 다듬을 때(`/intaeng:디자인` 2~4단계) `apple-design` 스킬의 규칙을 함께 본다: 누르는 순간의 피드백, 움직임 줄이기 설정, 글자 크기별 자간·행간, 단순함(꼭 필요한 것만), 길 찾기(어디인지·어디로 갈 수 있는지·나가는 법), 되돌릴 수 없는 조치에만 확인.
- 설치 위치는 사용자 범위 `~/.claude/skills/apple-design/`(레포에 복사하지 않는다). 무료(MIT), 스크립트 없음(SKILL.md 하나, 설치 전 내용 확인).
- 이미 정한 디자인 결정(spec 결정 27 구조, 결정 28 토큰·글꼴)과 부딪히면 결정이 우선한다 — 예: 시스템 글꼴 권장보다 Noto Sans KR(결정 28).

## 확인 방법
사람 리뷰 — 화면 PR 본문의 "스킬 적용 표"에 apple-design에서 읽은 규칙과 바뀐 것을 적고, 리뷰 때 확인한다.

## 이유
- 사용자가 디자인 작업에 이 스킬을 쓰라고 정했다(2026-10-30).
- 같은 작성자의 `emil-design-eng`를 이미 쓰고 있어 기준이 겹치지 않고 이어진다.

## 비교한 대안
1. `ui-ux-pro-max`·`emil-design-eng`만 — 이미 쓰지만 사용자가 따로 이 스킬을 지정했다.
2. 레포에 SKILL.md 복사 — 원본이 바뀌어도 따라가지 못하고, 다른 사람의 글을 레포에 들인다.

## 다시 볼 조건
- 스킬 원본이 크게 바뀌거나 라이선스가 바뀔 때.
- 스킬 규칙이 결정 27·28과 자주 부딪힐 때.
