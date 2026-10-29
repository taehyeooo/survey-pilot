---
id: "0001"
title: 결정은 ADR로 기록하고, 기록 위치를 나눈다
version: 1
status: active
date: 2026-10-28
sources:
  - 기본 원칙(intaeng 플러그인)
---

# 0001 결정은 ADR로 기록하고, 기록 위치를 나눈다

## 결정
- 방향·정책·구조를 정하면 `knowledge-base/decisions/`에 ADR을 하나 쓴다.
- 기록은 성격에 따라 나눠 둔다.
  - 결정과 이유 → `knowledge-base/decisions/` (ADR)
  - 작업 하나에서 한 것·확인한 것·확인하지 않은 것 → `knowledge-base/log.md` (append-only, [0010](0010-log-check-ci.md))
  - 지금 상태(진행 중·다음 할 일·답이 필요한 것) → `knowledge-base/now.md` (고쳐 씀, [0015](0015-now-md-handoff.md))
  - 근본 원인 → `knowledge-base/troubleshooting/`
  - 다시 쓸 개념·설명 → `knowledge-base/concepts/`
  - 알림이 울렸을 때 지금 할 순서 → `knowledge-base/runbooks/` (알림 하나에 문서 하나)
- 모든 ADR에 `## 확인 방법` 칸을 둔다. 이 결정을 지키는 테스트·훅·CI 이름을 적고, 없으면 "사람 리뷰"라고 적는다.
- 결정을 뒤집을 때는 기존 ADR을 지우지 않는다. 새 ADR을 쓰고, 기존 ADR은 `status: superseded`, `superseded_by: <새 번호>`로 바꾼다.
- 에이전트는 기존 ADR과 부딪히는 변경을 하기 전에 결정을 바꿀지 먼저 사람에게 묻는다.
- 질문에 답하며 정리한 설명이 다시 쓸 만하면 `concepts/`에 저장하고 목차에 한 줄 더한다.

## 이유
- 판단의 이유가 사람 머릿속이나 대화에만 있으면, 이미 정한 것을 다시 묻거나 모르고 뒤집게 된다.
- 결정·작업 기록·현재 상태를 한 파일에 섞으면 금방 길어져 원하는 것을 찾기 어렵다.
- 원인 분석(왜 그랬나)과 대응 순서(지금 무엇을 하나)는 읽는 때가 달라 따로 둔다.
- 확인 방법이 없으면 ADR만 보고 무엇이 이 결정을 지키는지 알 수 없다.

## 비교한 대안
1. 작업 기록 하나에 결정까지 쓰기 — 길어지면 결정을 찾을 수 없다.
2. CLAUDE.md에 모두 쓰기 — 매 세션 읽히는 파일이라 길수록 비용이 들고 규칙이 묻힌다([0013](0013-path-scoped-context-rules.md)).

## 확인 방법
- `scripts/check_docs.py`([0009](0009-docs-check-ci.md)): ADR frontmatter, `## 확인 방법` 칸, 목차 빠짐.
- 사람 리뷰: 결정을 ADR로 남겼는지, 좋은 답을 concepts로 옮겼는지는 PR 리뷰에서 본다.

## 다시 볼 조건
- 기록 위치가 여러 곳이라 갱신을 빠뜨리는 일이 반복되면, 합치거나 CI로 갱신을 강제하는 방법을 검토한다.
