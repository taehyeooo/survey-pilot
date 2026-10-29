---
paths:
  - "knowledge-base/now.md"
  - "docs/specs/**"
  - "docs/plans/**"
---

# 스킬·명령 고르기 — 상황 → 무엇

새 세션이 [now.md](../../knowledge-base/now.md)를 열 때, spec·plan을 쓸 때 Claude Code가 자동으로 읽는다. 고른 것을 무엇을·왜 쓰는지 한 줄로 말하고 진행한다. 설치되지 않은 것은 쓰지 않고 설치를 권한다.

intaeng 플러그인 명령(`/plugin install intaeng@taeng-marketplace`):

| 상황 | 명령 |
|---|---|
| 새 레포에 이 뼈대를 깔 때 | `/intaeng:지식베이스` |
| 새 기능·새 프로젝트를 기획할 때 — 단계별로 묻고 기능명세서(spec)로 | `/intaeng:기획` |
| 화면을 새로 만들거나 구조를 바꿀 때 — 디자인 4단계 | `/intaeng:디자인` (점검 `intaeng:design-review`, 문구 `intaeng:ux-writing-ko`) |
| 새 세션, "하던 거 뭐였지" | `/intaeng:이어하기` |
| 새 일 시작 — 이슈·브랜치·워크트리 | `/intaeng:시작` |
| PR 올리기 전 — 기록·검사·확인 증거 | `/intaeng:마무리` |
| PR 여러 개를 순서대로 머지 | `/intaeng:머지` |
| PR 크기 일을 하위 에이전트에게 | `/intaeng:맡기기` |
| 요구사항이 다 구현됐나 | `/intaeng:스펙점검` |

레포에서 정한 스킬(외부 스킬을 들이면 ADR과 함께 여기 한 줄):

| 상황 | 스킬 | 어디 | 근거 |
|---|---|---|---|
