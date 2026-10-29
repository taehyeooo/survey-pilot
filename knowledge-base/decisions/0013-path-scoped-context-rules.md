---
id: "0013"
title: CLAUDE.md는 늘 지킬 규칙만 200줄 이하로 두고, 경로별 규칙은 .claude/rules/에 paths로 둔다
version: 1
status: active
date: 2026-10-28
sources:
  - 기본 원칙(intaeng 플러그인)
  - https://code.claude.com/docs/en/memory
---

# 0013 CLAUDE.md는 늘 지킬 규칙만, 경로별 규칙은 .claude/rules/

## 결정
- `CLAUDE.md`에는 어떤 일을 하든 지킬 것만 둔다: 목표, 레포 지도, 작업 시작 전 할 일, 핵심 규칙, 기록 위치, Git 규칙, 하지 말 것.
- 특정 경로에서만 필요한 규칙은 `.claude/rules/<주제>.md`에 두고, frontmatter `paths:`(YAML 목록)로 경로를 적는다.
- `CLAUDE.md`는 규칙 파일마다 링크와 한 줄 요약을 둔다. 같은 내용을 두 곳에 쓰지 않고, 자세한 이유는 ADR을 링크한다.
- 검사: `scripts/check_context.py`를 PR CI에서 돌린다.
  1. `CLAUDE.md` 200줄 이하
  2. `.claude/rules/` 아래 모든 `.md`에 `paths:` 목록이 있고, 패턴이 올바르며 레포 파일 하나 이상에 맞는다
  3. `CLAUDE.md`가 규칙 파일마다 링크한다
  4. 깨진 상대 링크가 없다

## 이유
- `CLAUDE.md`는 매 세션 통째로 읽힌다. 길수록 비용이 들고 규칙을 덜 지킨다(공식 권고: 200줄 이하).
- `paths`가 있는 규칙 파일은 그 경로의 파일을 다룰 때만 읽혀, 필요한 때에만 비용을 낸다.
- frontmatter 형식이 틀리면 `paths`가 조용히 무시되고 항상 읽힌다. 패턴이 아무 파일에도 맞지 않으면 영원히 안 읽힌다. 둘 다 눈으로는 알기 어려워 CI로 검사한다.
- 줄 수 한도를 글로만 두면 AI가 계속 덧붙인다([0008](0008-enforce-commit-rules-hook-ci.md)와 같은 이유).

## 비교한 대안
1. `CLAUDE.md` 하나에 모두 — 규칙이 늘 때마다 모든 세션이 그 비용을 낸다.
2. `@path` 가져오기로 나누기 — 시작할 때 함께 읽혀 비용이 줄지 않는다.
3. 스킬로 옮기기 — 스킬은 부를 때만 읽혀 "이 파일을 고칠 때 반드시"를 보장하지 않는다. 절차는 스킬, 지킬 규칙은 rules.

## 확인 방법
- `scripts/check_context.py`와 그 테스트(PR CI에서 실행).

## 다시 볼 조건
- 경로 규칙이 읽혀야 할 때 안 읽혀 규칙을 어긴 일이 생기면, 그 규칙을 `CLAUDE.md`로 되돌리거나 경로를 넓힌다.
- Claude Code가 rules의 frontmatter 형식이나 읽는 시점을 바꾸면 검사를 맞춘다.
