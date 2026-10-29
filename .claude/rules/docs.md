---
paths:
  - "docs/**"
  - "knowledge-base/**"
  - "**/README.md"
---

# 문서 규칙

`docs/`·`knowledge-base/`·README를 읽거나 고칠 때 Claude Code가 자동으로 읽는다(ADR 0013).

- **문서 버전**: 폴더(v1/, v2/)로 나누지 않는다. frontmatter `version`, `status: active|superseded`. plan에는 `based_on: <문서> v<번호>`(ADR 0004).
- **문서 검사**: PR CI가 frontmatter·plan의 `based_on`(기준 문서 버전과 같아야 함)·깨진 링크·목차 빠짐을 검사한다. 문서를 고쳤으면 PR 전에 `python3 scripts/check_docs.py`(ADR 0009).
- **요구사항 ID**: spec 요구사항에 `- **R-1** ...`처럼 ID를 붙이면, plan 체크 단계 줄 끝에 `(R-1)`로 인용해야 한다. 확인하는 테스트에는 `<slug>#R-1`(spec 파일 이름에서 날짜·`.md`를 뺀 것)을 적는다(ADR 0014).
- **목차 빠짐**: `knowledge-base/` 문서를 새로 만들면 `index.md`나 자기 폴더 README 목록에 한 줄 요약과 링크를 더한다(ADR 0009).
- **ADR 확인 방법**: ADR은 `## 확인 방법`에 지키는 테스트·훅·CI 또는 "사람 리뷰"를 적는다(ADR 0001).
- **대응 문서**: frontmatter `alert`(카드 키), 단계 칸 목록 줄마다 `[자동]`·`[사람 확인]`.
- **log 항목은 짧게**: 네 칸마다 한두 문장, 긴 확인은 PR 본문에. 이미 쓴 줄은 고치지 않는다(ADR 0010).
- **코드가 기준인 정보**(엔드포인트·컬럼 목록 등)는 문서에 복제하지 않는다(ADR 0007).
