# 결정 기록 (ADR)

"무엇을, 왜 그렇게 정했나"를 한 곳에 모은다. 한 번 정한 것을 다시 묻거나 모르고 뒤집지 않기 위해서다([0001](0001-decision-records.md)).

## 쓰는 법

- 파일: `NNNN-짧은-영어-제목.md`, 번호는 이어서 붙인다.
- frontmatter: `id`·`title`·`version`·`status`·`date`·`sources`. `status`는 `active` / `superseded`.
- 본문: `## 결정` · `## 이유` · `## 비교한 대안` · `## 확인 방법` · `## 다시 볼 조건`.
- `## 확인 방법`에는 이 결정을 지키는 테스트·훅·CI를, 없으면 "사람 리뷰"를 적는다.
- 뒤집을 때는 지우지 않는다. 새 ADR을 쓰고, 기존 ADR에 `status: superseded`와 `superseded_by`를 적은 뒤 아래 목록을 갱신한다.
- 에이전트는 기존 ADR과 부딪히는 변경을 하기 전에 결정을 바꿀지 먼저 묻는다.
- 새 ADR을 쓰면 이 목록과 `knowledge-base/log.md`를 갱신한다.
- 아래 0001~0016은 기본 원칙이다. 팀에 맞지 않으면 지우지 말고 새 ADR로 뒤집는다.

## 목록

| 번호 | 결정 | 상태 | 날짜 |
|---|---|---|---|
| [0001](0001-decision-records.md) | 결정은 ADR로 기록하고, 기록 위치를 나눈다(ADR·log·now·troubleshooting·concepts·runbooks). ADR엔 확인 방법 칸 | active | 2026-10-28 |
| [0002](0002-cost-zero-free-tiers.md) | 비용 0원 — 유료 API를 기본값으로 쓰지 않고 무료 티어부터, 유료 전환은 먼저 묻기 | active | 2026-10-28 |
| [0003](0003-validate-with-own-samples.md) | 가설·파이프라인은 내 데이터 20~30개 샘플로 먼저 검증 | active | 2026-10-28 |
| [0004](0004-doc-versioning-frontmatter.md) | 문서 버전은 frontmatter로, 버전 폴더 복사 금지 | active | 2026-10-28 |
| [0005](0005-mcp-only-what-is-used.md) | MCP는 실제로 쓰는 것만, 들일 때 무료 확인과 ADR | active | 2026-10-28 |
| [0006](0006-code-style-follow-repo.md) | 코드 스타일은 레포가 실제로 쓰는 방식, 일괄 포맷은 별도 PR | active | 2026-10-28 |
| [0007](0007-code-is-source-of-truth.md) | 코드가 기준인 정보는 문서에 복제하지 않음 | active | 2026-10-28 |
| [0008](0008-enforce-commit-rules-hook-ci.md) | 커밋 규칙은 로컬 훅과 PR CI에서 같은 스크립트로, CI 실패 PR은 머지하지 않음 | active | 2026-10-28 |
| [0009](0009-docs-check-ci.md) | 문서 규칙(frontmatter·based_on·깨진 링크·목차 빠짐)은 PR CI에서 검사 | active | 2026-10-28 |
| [0010](0010-log-check-ci.md) | log.md는 append-only — 미갱신 경고, 기존 줄 수정·삭제 실패, 항목은 짧게 | active | 2026-10-28 |
| [0011](0011-ops-internals-off-by-default.md) | 운영 내부 정보(API 문서·지표)는 기본 꺼짐, 켜도 밖에 열지 않음 | active | 2026-10-28 |
| [0012](0012-admin-actions-confirm-and-audit.md) | 데이터를 바꾸는 관리자·운영 조치는 미리보기 → 사유·재확인 → 실행, 감사 기록 | active | 2026-10-28 |
| [0013](0013-path-scoped-context-rules.md) | CLAUDE.md는 늘 지킬 규칙만(200줄 이하), 경로별 규칙은 .claude/rules/에 paths로 | active | 2026-10-28 |
| [0014](0014-requirement-trace.md) | spec 요구사항 ID(R-번호)를 plan과 테스트가 인용하고 CI가 검사 | active | 2026-10-28 |
| [0015](0015-now-md-handoff.md) | 지금 상태는 now.md 하나에 고쳐 쓰는 인계 메모 | active | 2026-10-28 |
| [0016](0016-autonomous-mode-permission-bundle.md) | 자율 모드 — 시작할 때 받은 권한 묶음 안에서는 묻지 않고 진행, 밖은 승인 대기 | active | 2026-10-28 |
| [0017](0017-respondent-privacy.md) | 응답자 이메일은 인증·중복 확인에만, 해시로 확인, 마감 30일 후 원문 삭제, Gemini 처리 고지 | active | 2026-10-29 |
| [0018](0018-free-tier-limit-guard.md) | 무료 한도(Gemini·Gmail)는 환경변수 + DB 카운터로 부르기 전에 막음 | active | 2026-10-29 |
| [0019](0019-respondents-via-server-only.md) | 응답자 쪽은 DB 직접 접근 없이 서버 라우트로만, anon 정책 없음 | active | 2026-10-29 |
| [0020](0020-multi-user-and-operator.md) | 누구나 가입하는 여러 사용자 서비스, 운영 페이지는 따로·목록과 숫자만, 탈퇴 즉시 삭제, 한도는 함께 씀 | active | 2026-10-30 |
