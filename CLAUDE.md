# survey-pilot

설문조사 자동화 웹페이지 (4일 목표)

목표: **내가 없어도 개발이 돌아가는 레포.** 판단 기준과 지식을 문서로 꺼내, AI와 사람이 같은 기준으로 일한다.
이 파일은 늘 지킬 규칙만 둔다(200줄 이하). 결정과 이유는 [knowledge-base/decisions/](knowledge-base/decisions/README.md), 목차는 [knowledge-base/index.md](knowledge-base/index.md).

## 작업 시작 전

1. 새 세션이면 인계 메모 [now.md](knowledge-base/now.md)부터 본다.
2. 관련 ADR을 읽는다. ADR과 부딪히는 변경은 하기 전에 결정을 바꿀지 사용자에게 묻는다.
3. 문서 먼저: 요구사항·설계는 `docs/specs/`, 구현 순서는 `docs/plans/`(양식: `docs/templates/`).
4. 사람 손이 필요한 일(키·DB·외부 가입)은 시작할 때 한 번에 묻는다.

## 핵심 규칙

- **근본 원인까지**: 증상만 고치지 않는다. 왜 에러? → 개념은 어떻게 동작? → 구조는 왜 이렇게? 알게 된 건 `knowledge-base/troubleshooting/`에.
- **비용 0원**: 유료 API를 기본값으로 넣지 않는다. 무료 티어부터 확인하고 한도를 코드에 반영한다. 유료 전환은 먼저 묻는다(ADR 0002).
- **샘플 검증 먼저**: 가설·파이프라인은 내 데이터 20~30개로 먼저 검증한 뒤 구조를 만든다(ADR 0003).
- **코드 스타일**: 레포가 실제로 쓰는 방식을 따른다. 일괄 포맷은 별도 PR로(ADR 0006).
- **테스트 먼저**: 테스트를 먼저 쓰고, 일부러 망가뜨려(변형) 테스트가 잡는지 본다.
- **검증 층**: 규칙은 테스트·훅·CI로 강제한다. 데이터 추출은 건수 검증(원본 N건 → 결과 N건).

## 경로별 규칙 (`.claude/rules/`)

그 경로의 파일을 읽거나 고칠 때 Claude Code가 자동으로 더 읽는다(ADR 0013). 규칙 파일은 `paths:` 필수 — `scripts/check_context.py`가 검사한다.

- [docs.md](.claude/rules/docs.md) — `docs/`·`knowledge-base/`·README: frontmatter 버전·`based_on`, 문서 검사, 코드가 기준인 정보는 복제 금지
- [skills.md](.claude/rules/skills.md) — 상황 → 스킬·명령 표

## 기록 위치

| 무엇 | 어디 | 언제 |
|---|---|---|
| 결정과 이유 | `knowledge-base/decisions/` (ADR) | 방향·정책·구조를 정할 때 |
| 한 것·확인한 것·확인하지 않은 것 | `knowledge-base/log.md` (append-only) | 작업(PR)이 끝날 때 |
| 지금 상태(진행 중·다음 할 일·답이 필요한 것) | `knowledge-base/now.md` (고쳐 씀) | 작업이 끝날 때, 순서가 바뀔 때 |
| 근본 원인 | `knowledge-base/troubleshooting/` | 원인을 찾았을 때 |
| 알림 대응 순서 | `knowledge-base/runbooks/` | 알림을 만들 때 |
| 개념 | `knowledge-base/concepts/` | 개념을 새로 이해했을 때 |
| 기능 설계 / 구현 순서 | `docs/specs/` / `docs/plans/` | 만들기 전 |

- 이유는 사용자의 말이나 실측 근거로 적는다. 확인하지 않은 것은 확인하지 않았다고 적는다.
- 작업이 끝나면 `log.md`에 한 항목, `now.md`를 고쳐 쓴다. 칸마다 짧게, 긴 확인은 PR 본문에(ADR 0010).

## 앱 명령

Next.js 16 — 코드를 쓰기 전에 [AGENTS.md](AGENTS.md)대로 `node_modules/next/dist/docs/`의 해당 문서를 본다.
`npm run lint` · `npm test`(Vitest, `test/`) · `npm run build` · `npm run check:bundle`(빌드 뒤 클라이언트 번들 비밀값 검사). 비밀값은 레포 루트 `.env.local`(양식 `.env.example`), 워크트리에는 복사해 쓴다. Gemini·메일은 테스트에서 `test/fakes.ts`의 가짜를 쓴다.

## 워크트리 흐름

작업 하나 = 이슈 하나 = 브랜치 하나 = 워크트리 하나.
- 시작할 때 `git branch --show-current`로 브랜치를 확인한다. 기본 브랜치에서 직접 작업하지 않는다.
- 하나뿐인 자원(로컬 포트, 테스트 계정, 외부 API 하루 한도)은 한 작업에서만 쓴다.
- `.env` 같은 비밀 파일은 커밋하지 않고, 외부로 보내지 않는다.
- 프로세스는 PID로만 끈다(이름으로 한꺼번에 끄지 않는다).

## Git 컨벤션 (예외 없이)

- 브랜치: `타입/#이슈번호-내용` (예: `feat/#12-login`)
- 커밋 메시지: `타입: 내용` 형식만. 타입은 `feat` / `fix` / `docs` / `style` / `refactor` / `chore` / `perf` / `test`.
  - 다른 텍스트를 붙이지 않는다. **AI 서명·트레일러·이모지 금지**("Generated with …", "Co-Authored-By: …").
  - 커밋은 의미 단위로 나눈다.
- PR 본문에 `Closes #이슈번호`. PR 본문에도 AI 서명·이모지를 붙이지 않는다. PR 제목도 `타입: 내용`.
- 커밋 메시지는 훅(`.githooks/commit-msg`)과 PR CI가 검사한다(ADR 0008). `--no-verify`로 건너뛰지 않는다. CI가 실패한 PR은 머지하지 않는다.

## AI 도구

- MCP는 실제로 쓰는 것만 레포 `.mcp.json`에 등록한다. 넣을 때는 무료 여부 확인 → 언제 쓰는지 → ADR(ADR 0005).
- 상황별 스킬·명령은 [skills.md](.claude/rules/skills.md). 고른 스킬을 무엇을·왜 쓰는지 한 줄로 말하고 진행한다.

## 하지 말 것

- 유료 API를 기본 옵션으로 코드에 넣지 않는다.
- 검증하지 않은 파이프라인 위에 구조부터 짜지 않는다.
- 문서를 버전 폴더로 복사하지 않는다(ADR 0004).
