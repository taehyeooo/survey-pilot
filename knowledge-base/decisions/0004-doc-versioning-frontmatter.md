---
id: "0004"
title: 문서 버전은 frontmatter로 관리하고, 버전 폴더로 복사하지 않는다
version: 1
status: active
date: 2026-10-28
sources:
  - 기본 원칙(intaeng 플러그인)
---

# 0004 문서 버전은 frontmatter로, 폴더 복사 금지

## 결정
- 문서는 현재 문서 하나만 둔다. `v1/`, `v2/` 같은 버전 폴더를 만들지 않는다.
- frontmatter에 `version: <번호>`, `status: active | superseded`를 둔다.
- 버전을 올린 이유는 문서 안 변경 이력에 한 줄로 남기고, 방향이 바뀌는 큰 변경은 ADR로 남긴다.
- plan 문서는 `based_on: <문서 경로> v<번호>`로 기준 문서와 버전을 적는다.
- 옛 내용이 필요하면 git 이력에서 본다.

## 이유
- 폴더로 복사하면 어느 것이 최신인지 헷갈리고, 링크가 옛 문서를 가리키게 된다.
- git이 이미 이력을 갖고 있어 복사본은 중복이다.
- `based_on`에 버전을 적어 두면, 기준 문서가 바뀌었을 때 plan을 다시 봐야 한다는 것을 기계가 알려 줄 수 있다([0009](0009-docs-check-ci.md)).

## 비교한 대안
1. 버전 폴더(`v1/`, `v2/`) — 최신 판별과 링크 관리가 어렵다.
2. 파일 이름에 버전(`spec-v2.md`) — 이름이 바뀔 때마다 링크가 깨진다.
3. 버전 표시 없이 git 이력만 — plan이 어느 판을 기준으로 했는지 알 수 없다.

## 확인 방법
- `scripts/check_docs.py`([0009](0009-docs-check-ci.md)): frontmatter의 `version`·`status`, plan의 `based_on` 형식과 버전 일치.

## 다시 볼 조건
- 여러 판을 동시에 운영해야 하는 문서(예: 외부에 공개한 API 문서의 여러 버전)가 생기면 그 문서만 예외를 따로 정한다.
