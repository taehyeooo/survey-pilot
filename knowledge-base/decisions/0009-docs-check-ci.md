---
id: "0009"
title: 문서 규칙(frontmatter·based_on·깨진 링크·목차 빠짐)은 PR CI에서 검사한다
version: 1
status: active
date: 2026-10-28
sources:
  - 기본 원칙(intaeng 플러그인)
---

# 0009 문서 규칙은 PR CI에서 검사한다

## 결정
- `scripts/check_docs.py`(표준 라이브러리만)를 PR CI에서 돌린다. 로컬에서도 같은 명령으로 돌릴 수 있다.
- 검사 항목
  1. **frontmatter** — 문서 종류마다 필수 항목(ADR: id·title·version·status·date·sources). `version`은 양의 정수, `status`는 `active | superseded`, ADR `id`는 파일 번호와 같고, `superseded_by`는 실제 ADR을 가리킨다.
  2. **plan의 based_on** — `<경로> v<번호>` 형식, 기준 문서가 있고 superseded가 아니며 버전이 같다([0004](0004-doc-versioning-frontmatter.md)).
  3. **깨진 상대 링크** — 마크다운 링크와 frontmatter의 경로. 코드 블록 안과 외부 URL은 보지 않는다.
  4. **목차 빠짐** — `knowledge-base/` 안 문서는 `index.md` 또는 자기 폴더 README에서 링크되어야 한다.
  5. **ADR 확인 방법** — ADR에 `## 확인 방법` 칸이 있고 비어 있지 않다([0001](0001-decision-records.md)).
- 검사 스크립트의 테스트를 먼저 돌린다. 실패한 PR은 머지하지 않는다([0008](0008-enforce-commit-rules-hook-ci.md)).

## 이유
- 문서 규칙을 글로만 두면 사람도 AI도 빠뜨린다. 빠진 frontmatter·깨진 링크는 시간이 지나야 드러난다.
- 기준 문서가 바뀌었는데 plan이 따라오지 않으면, 낡은 계획대로 구현하게 된다.
- 목차에 없는 문서는 아무도 찾지 못해 없는 것과 같다.
- 표준 라이브러리만 쓰면 CI가 가볍고 설치할 것이 없다.

## 비교한 대안
1. 사람 리뷰로만 확인 — 매번 같은 것을 손으로 봐야 하고 빠뜨린다.
2. 로컬 훅에도 넣기 — 문서 검사는 레포 전체를 보므로 커밋마다 돌리기엔 무겁다. CI와 로컬 수동 실행으로 충분하다.
3. 외부 링크 검사 도구 — 외부 사이트 상태에 따라 결과가 흔들린다.

## 확인 방법
- `scripts/check_docs.py`와 그 테스트(PR CI에서 실행).

## 다시 볼 조건
- 문서 종류가 늘면(새 폴더·새 frontmatter 항목) 검사 항목을 테스트 사례부터 더한다.
- 검사가 정상 문서를 자주 막으면 그 규칙을 경고로 내린다.
