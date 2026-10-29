#!/usr/bin/env python3
"""check_docs.py 테스트. 사용: python3 scripts/test_check_docs.py
규칙을 바꾸면 여기에 사례를 먼저 추가한다.
"""

import contextlib
import io
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_docs  # noqa: E402

ADR = """---
id: "{id}"
title: 결정
version: 1
status: {status}
{extra}date: 2026-10-13
sources:
  - https://example.com
---

# {id} 결정

## 확인 방법
- 사람 리뷰
"""

SPEC = """---
title: 스펙
version: {version}
status: {status}
---

# 스펙
"""

PLAN = """---
title: 계획
version: 1
status: {status}
based_on: {based_on}
---

# 계획
"""


class CheckDocsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, rel, text):
        path = os.path.join(self.root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def errors(self):
        return [message for _, _, message in check_docs.check(self.root)]

    def assert_ok(self):
        self.assertEqual(self.errors(), [])

    def assert_error(self, fragment):
        errors = self.errors()
        self.assertTrue(any(fragment in e for e in errors), f"`{fragment}` 오류가 없다: {errors}")

    # frontmatter — ADR

    def test_올바른_ADR은_통과(self):
        self.write("knowledge-base/decisions/0001-a.md", ADR.format(id="0001", status="active", extra=""))
        self.assert_ok()

    def test_frontmatter가_없으면_실패(self):
        self.write("knowledge-base/decisions/0001-a.md", "# 0001 결정\n")
        self.assert_error("frontmatter가 없다")

    def test_ADR_status_누락(self):
        text = ADR.format(id="0001", status="active", extra="").replace("status: active\n", "")
        self.write("knowledge-base/decisions/0001-a.md", text)
        self.assert_error("`status`가 없다")

    def test_ADR_status_허용값_밖(self):
        self.write("knowledge-base/decisions/0001-a.md", ADR.format(id="0001", status="확정", extra=""))
        self.assert_error("status는")

    def test_status_뒤_주석은_무시(self):
        self.write("knowledge-base/decisions/0001-a.md",
                   ADR.format(id="0001", status="active   # active | superseded", extra=""))
        self.assert_ok()

    def test_ADR_id가_파일_번호와_다름(self):
        self.write("knowledge-base/decisions/0002-a.md", ADR.format(id="0001", status="active", extra=""))
        self.assert_error("파일 번호")

    def test_superseded_ADR에_superseded_by_없음(self):
        self.write("knowledge-base/decisions/0001-a.md", ADR.format(id="0001", status="superseded", extra=""))
        self.assert_error("superseded_by")

    def test_superseded_by가_없는_ADR을_가리킴(self):
        self.write("knowledge-base/decisions/0001-a.md",
                   ADR.format(id="0001", status="superseded", extra="superseded_by: 0009\n"))
        self.assert_error("ADR 파일이 없다")

    def test_superseded_by가_있는_ADR을_가리키면_통과(self):
        self.write("knowledge-base/decisions/0001-a.md",
                   ADR.format(id="0001", status="superseded", extra="superseded_by: 2\n"))
        self.write("knowledge-base/decisions/0002-b.md", ADR.format(id="0002", status="active", extra=""))
        self.assert_ok()

    def test_sources_목록이_비면_실패(self):
        text = ADR.format(id="0001", status="active", extra="").replace("  - https://example.com\n", "")
        self.write("knowledge-base/decisions/0001-a.md", text)
        self.assert_error("`sources`가 없다")

    # frontmatter — 그 밖의 문서

    def test_version이_정수가_아니면_실패(self):
        self.write("docs/specs/a.md", SPEC.format(version="v2", status="active"))
        self.assert_error("version은 양의 정수")

    def test_README와_템플릿은_검사하지_않음(self):
        self.write("docs/specs/README.md", "# 안내\n")
        self.write("docs/templates/spec.md", "---\nversion: X\n---\n")
        self.assert_ok()

    def test_스크립트_템플릿의_링크는_만든_뒤_위치_기준이라_검사하지_않는다(self):
        self.write("scripts/templates/service/README.md", "[스타터](../../packages/x/README.md)\n")
        self.assert_ok()
        self.write("scripts/other.md", "[없음](none.md)\n")  # 템플릿 밖은 그대로 검사
        self.assert_error("깨진 링크")

    def test_트러블슈팅은_자기_status_허용값(self):
        self.write("knowledge-base/troubleshooting/a.md", "---\ntitle: t\ndate: 2026-10-13\nstatus: workaround\n---\n")
        self.assert_ok()
        self.write("knowledge-base/troubleshooting/a.md", "---\ntitle: t\ndate: 2026-10-13\nstatus: active\n---\n")
        self.assert_error("status는")

    def test_대응_문서는_title_version_status_alert가_있어야_한다(self):
        self.write("knowledge-base/runbooks/a.md", "---\ntitle: t\nversion: 1\nstatus: active\nalert: a\n---\n")
        self.assert_ok()
        self.write("knowledge-base/runbooks/a.md", "---\ntitle: t\nstatus: active\nalert: a\n---\n")
        self.assert_error("`version`")
        self.write("knowledge-base/runbooks/a.md", "---\ntitle: t\nversion: 1\nstatus: active\n---\n")
        self.assert_error("`alert`")

    # 대응 문서 단계 표시 (런북 단계마다 [자동]·[사람 확인])

    RUNBOOK = "---\ntitle: t\nversion: 1\nstatus: active\nalert: a\n---\n\n# t\n\n{body}"

    def test_단계_칸의_목록_줄은_표시가_있어야_한다(self):
        body = ("## 무슨 뜻인가\n- 설명은 표시 없이\n\n## 먼저 볼 것 (5분 안)\n1. [자동] 오류 탭을 본다.\n"
                "2. [사람 확인] 판단한다.\n   - 들여 쓴 줄은 보지 않는다\n\n## 원인 좁히기\n- 가설은 표시 없이\n\n"
                "## 조치\n- [사람 확인] 스위치를 끈다.\n\n## 끝나면\n- [자동] [회복] 알림이 온다.\n")
        self.write("knowledge-base/runbooks/a.md", self.RUNBOOK.format(body=body))
        self.assert_ok()

    def test_단계_표시가_없으면_실패(self):
        self.write("knowledge-base/runbooks/a.md", self.RUNBOOK.format(body="## 조치\n- 스위치를 끈다.\n"))
        self.assert_error("[자동]")

    def test_켜기_끄기_칸도_단계다(self):
        self.write("knowledge-base/runbooks/a.md", self.RUNBOOK.format(body="## 끄기\n1. 미리보기를 본다.\n"))
        self.assert_error("[사람 확인]")

    def test_다른_표시는_실패(self):
        self.write("knowledge-base/runbooks/a.md", self.RUNBOOK.format(body="## 먼저 볼 것\n1. [수동] 본다.\n"))
        self.assert_error("[자동]")

    def test_단계_표시_실패는_그_줄을_가리킨다(self):
        self.write("knowledge-base/runbooks/a.md", self.RUNBOOK.format(body="## 조치\n- [자동] 본다.\n- 끈다.\n"))
        found = [(rel, line) for rel, line, message in check_docs.check(self.root) if "[자동]" in message]
        self.assertEqual(found, [("knowledge-base/runbooks/a.md", 12)])

    def test_대응_문서_README는_단계를_검사하지_않는다(self):
        self.write("knowledge-base/runbooks/README.md", "# 대응\n\n## 조치\n- 표시 없음\n")
        self.assert_ok()

    # ADR 확인 방법 칸 (CONFIRMATION_FROM 번호부터)

    def adr(self, number, body):
        base = ADR.format(id=number, status="active", extra="").replace("\n## 확인 방법\n- 사람 리뷰\n", "")
        return base.replace(f"# {number} 결정\n", f"# {number} 결정\n\n{body}")

    def test_새_ADR은_확인_방법_칸이_있어야_한다(self):
        n = f"{check_docs.CONFIRMATION_FROM:04d}"
        self.write(f"knowledge-base/decisions/{n}-a.md", self.adr(n, "## 결정\n- 한다.\n"))
        self.assert_error("확인 방법")

    def test_확인_방법_칸이_비면_실패(self):
        n = f"{check_docs.CONFIRMATION_FROM:04d}"
        self.write(f"knowledge-base/decisions/{n}-a.md",
                   self.adr(n, "## 확인 방법\n<!-- 테스트·훅·CI 또는 사람 리뷰 -->\n\n## 다시 볼 조건\n- 없음\n"))
        self.assert_error("확인 방법")

    def test_확인_방법을_적으면_통과(self):
        n = f"{check_docs.CONFIRMATION_FROM:04d}"
        self.write(f"knowledge-base/decisions/{n}-a.md", self.adr(n, "## 확인 방법\n- 사람 리뷰\n"))
        self.assert_ok()

    def test_이전_ADR은_확인_방법_칸을_요구하지_않는다(self):
        n = f"{check_docs.CONFIRMATION_FROM - 1:04d}"
        self.write(f"knowledge-base/decisions/{n}-a.md", self.adr(n, "## 결정\n- 한다.\n"))
        self.assert_ok()

    # 목차 빠짐 (knowledge-base/index.md가 있을 때만)

    TS = "---\ntitle: t\ndate: 2026-10-13\nstatus: resolved\n---\n"

    def kb(self, index="# 목차\n", readme="# 트러블슈팅\n"):
        self.write("knowledge-base/index.md", index)
        self.write("knowledge-base/troubleshooting/README.md", readme)
        self.write("knowledge-base/troubleshooting/2026-a.md", self.TS)

    def test_목차와_폴더_README_어디에도_없으면_실패(self):
        self.kb()
        self.assert_error("목차")

    def test_폴더_README에서_링크하면_통과(self):
        self.kb(readme="# 트러블슈팅\n\n- [a](2026-a.md#원인) — 한 줄\n")
        self.assert_ok()

    def test_index에서_링크하면_통과(self):
        self.kb(index="# 목차\n\n- [a](troubleshooting/2026-a.md)\n")
        self.assert_ok()

    def test_다른_문서에서만_링크하면_실패(self):
        self.kb()
        self.write("knowledge-base/concepts/README.md", "# 개념\n\n- [x](x.md)\n")
        self.write("knowledge-base/concepts/x.md", "---\ntitle: x\nversion: 1\nstatus: active\n---\n"
                                                   "[a](../troubleshooting/2026-a.md)\n")
        self.write("knowledge-base/index.md", "# 목차\n\n- [x](concepts/x.md)\n")
        found = [rel for rel, _, message in check_docs.check(self.root) if "목차" in message]
        self.assertEqual(found, ["knowledge-base/troubleshooting/2026-a.md"])

    def test_코드_블록_안의_링크는_목차가_아니다(self):
        self.kb(readme="# 트러블슈팅\n\n```\n[a](2026-a.md)\n```\n")
        self.assert_error("목차")

    def test_폴더_README가_없으면_index에_있어야_한다(self):
        self.write("knowledge-base/index.md", "# 목차\n")
        self.write("knowledge-base/sources/s.md", "# 자료\n")
        self.assert_error("목차")
        self.write("knowledge-base/index.md", "# 목차\n\n- [s](sources/s.md)\n")
        self.assert_ok()

    def test_README와_index는_목차_검사_대상이_아니다(self):
        self.write("knowledge-base/index.md", "# 목차\n")
        self.write("knowledge-base/troubleshooting/README.md", "# 트러블슈팅\n")
        self.assert_ok()

    def test_index가_없으면_목차_검사를_하지_않는다(self):
        self.write("knowledge-base/troubleshooting/2026-a.md", self.TS)
        self.assert_ok()

    # based_on

    def test_based_on_정상(self):
        self.write("docs/specs/a.md", SPEC.format(version="2", status="active"))
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="docs/specs/a.md v2"))
        self.assert_ok()

    def test_based_on_누락(self):
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="").replace("based_on: \n", ""))
        self.assert_error("`based_on`가 없다")

    def test_based_on_형식_오류(self):
        self.write("docs/specs/a.md", SPEC.format(version="1", status="active"))
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="docs/specs/a.md"))
        self.assert_error("형식")

    def test_based_on_기준_문서_없음(self):
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="docs/specs/none.md v1"))
        self.assert_error("기준 문서가 없다")

    def test_based_on_기준_문서가_superseded(self):
        self.write("docs/specs/a.md", SPEC.format(version="1", status="superseded"))
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="docs/specs/a.md v1"))
        self.assert_error("superseded 상태")

    def test_based_on_버전_불일치(self):
        self.write("docs/specs/a.md", SPEC.format(version="3", status="active"))
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="docs/specs/a.md v2"))
        self.assert_error("v2인데 기준 문서는 v3")

    def test_superseded_plan은_based_on을_검사하지_않음(self):
        self.write("docs/specs/a.md", SPEC.format(version="3", status="active"))
        self.write("docs/plans/p.md", PLAN.format(status="superseded", based_on="docs/specs/a.md v1"))
        self.assert_ok()

    def test_based_on_plan_기준_상대경로(self):
        self.write("docs/specs/a.md", SPEC.format(version="1", status="active"))
        self.write("docs/plans/p.md", PLAN.format(status="active", based_on="../specs/a.md v1"))
        self.assert_ok()

    # 요구사항 ID 추적 (ADR 0014)

    def trace(self, spec_reqs, plan_body, spec_status="active", plan_status="active", spec="docs/specs/a.md"):
        self.write(spec, SPEC.format(version="1", status=spec_status) + "\n## 요구사항\n" + spec_reqs)
        if plan_body is not None:
            self.write("docs/plans/p.md",
                       PLAN.format(status=plan_status, based_on=f"{spec} v1") + "\n## 단계\n" + plan_body)

    def warnings(self):
        warnings = []
        check_docs.check(self.root, warnings)
        return [message for _, _, message in warnings]

    REQS = "- **R-1** 첫째\n- **R-2** 둘째\n"

    def test_요구사항을_모두_인용하면_통과(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1)\n2. [x] 고친다 (R-1, R-2)\n")
        self.assert_ok()
        # 남는 경고는 테스트 연결(ADR 0014)뿐 — plan 경고는 없다
        self.assertEqual([w for w in self.warnings() if "plan" in w], [])

    def test_인용되지_않은_요구사항은_실패(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1)\n")
        self.assert_error("R-2")
        self.assert_error("인용되지 않았다")

    def test_spec에_없는_ID를_인용하면_실패(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1, R-2, R-3)\n")
        self.assert_error("R-3")
        self.assert_error("없는 요구사항")

    def test_기준_spec에_ID가_없는데_인용하면_실패(self):
        self.trace("1. 그냥 요구사항\n", "1. [ ] 만든다 (R-1)\n")
        self.assert_error("없는 요구사항")

    def test_중복_ID는_실패(self):
        self.trace("- **R-1** 첫째\n- **R-1** 또 첫째\n", "1. [ ] 만든다 (R-1)\n")
        self.assert_error("중복")

    def test_ID가_없는_spec은_검사하지_않는다(self):
        # 옵트인 — 지금 레포의 spec·plan이 그대로 통과해야 한다
        self.trace("1. 첫째\n2. 둘째\n", "1. [ ] 만든다\n")
        self.assert_ok()
        self.assertEqual(self.warnings(), [])
        self.trace("1. 첫째\n", None, spec="docs/specs/b.md")  # plan이 없어도 경고 없음
        self.assertEqual(self.warnings(), [])

    def test_체크_단계가_아닌_곳의_인용은_세지_않는다(self):
        self.trace(self.REQS, "범위: R-1, R-2를 다룬다\n1. [ ] 만든다 (R-1)\n   - 확인: R-2 테스트\n")
        self.assert_error("`R-2`")
        errors = self.errors()
        self.assertFalse(any("`R-1`" in e for e in errors), errors)

    #,
    def test_여러_체크_단계_모양을_읽는다(self):
        self.trace(self.REQS + "- **R-3** 셋째\n", "- [ ] 하나 (R-1)\n3-1. [~] 둘 (R-2)\n* [X] 셋 (R-3)\n")
        self.assert_ok()

    def test_번호_목록_정의도_읽는다(self):
        self.trace("1. **R-1** 첫째\n2. **R-2** 둘째\n", "1. [ ] 만든다 (R-1)\n")
        self.assert_error("`R-2`")

    def test_여러_plan이_함께_인용하면_통과(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1)\n")
        self.write("docs/plans/q.md", PLAN.format(status="active", based_on="docs/specs/a.md v1") + "1. [ ] 고친다 (R-2)\n")
        self.assert_ok()

    def test_superseded_plan의_인용은_세지_않고_검사하지도_않는다(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1, R-2, R-9)\n", plan_status="superseded")
        self.write("docs/plans/q.md", PLAN.format(status="active", based_on="docs/specs/a.md v1") + "1. [ ] 만든다 (R-1)\n")
        errors = self.errors()
        self.assertTrue(any("`R-2`" in e and "인용되지 않았다" in e for e in errors), errors)
        self.assertFalse(any("R-9" in e for e in errors), errors)

    def test_superseded_spec은_검사하지_않는다(self):
        self.trace(self.REQS, None, spec_status="superseded")
        self.assert_ok()
        self.assertEqual(self.warnings(), [])

    def test_plan이_없는_spec은_경고만(self):
        self.trace(self.REQS, None)
        self.assert_ok()
        warnings = self.warnings()
        self.assertTrue(any("plan" in w for w in warnings), warnings)

    def test_코드_안의_ID는_정의도_인용도_아니다(self):
        self.trace(self.REQS + "예: `- **R-7** 문장`\n```\n- **R-8** 코드\n```\n",
                   "1. [ ] 만든다 (R-1, R-2) — 예시 `R-9`\n```\n1. [ ] 코드 (R-9)\n```\n")
        self.assert_ok()

    def test_다른_ID와_섞이지_않는다(self):
        # FR-1·R-12는 R-1이 아니다
        self.trace("- **R-1** 첫째\n- **R-12** 열둘째\n", "1. [ ] 만든다 (FR-1, R-12)\n")
        self.assert_error("`R-1`")
        self.trace("- **R-1** 첫째\n- **R-12** 열둘째\n", "1. [ ] 만든다 (R-1, R-12)\n")
        self.assert_ok()

    def test_서비스_폴더의_spec도_검사한다(self):
        self.write("services/shop/docs/specs/a.md", SPEC.format(version="1", status="active") + self.REQS)
        self.write("services/shop/docs/plans/p.md",
                   PLAN.format(status="active", based_on="../specs/a.md v1") + "1. [ ] 만든다 (R-1)\n")
        self.assert_error("`R-2`")

    def test_정의_줄에서_실패_위치를_가리킨다(self):
        self.trace(self.REQS, "1. [ ] 만든다 (R-1)\n")
        found = [(rel, line) for rel, line, message in check_docs.check(self.root) if "`R-2`" in message]
        self.assertEqual(found, [("docs/specs/a.md", 11)])

    # 요구사항 → 테스트 연결 (ADR 0014, `<slug>#R-n`)
    # 이 파일도 검사 대상(테스트 소스)이라, 인용 예시는 ref()로 이어 붙여 실제 인용으로 읽히지 않게 한다.

    def ref(self, slug, n):
        return slug + "#R-" + str(n)

    def spec_with_plan(self, spec="docs/specs/2026-10-15-a.md", reqs=REQS):
        self.write(spec, SPEC.format(version="1", status="active") + "\n## 요구사항\n" + reqs)
        plan = os.path.join(os.path.dirname(os.path.dirname(spec)), "plans", "p.md").replace(os.sep, "/")
        ids = ", ".join(f"R-{n}" for n in check_docs.REQ_ID_RE.findall(reqs))
        self.write(plan, PLAN.format(status="active", based_on=f"{spec} v1") + f"1. [ ] 만든다 ({ids})\n")

    def report(self):
        report = []
        check_docs.check(self.root, [], report)
        return report

    def test_테스트가_인용한_요구사항을_센다(self):
        #,
        self.spec_with_plan()
        self.write("scripts/test_a.py", f"# {self.ref('a', 1)}\ndef test_x():\n    pass\n")
        self.assert_ok()
        [row] = self.report()
        self.assertEqual((row["slug"], row["total"], row["tested"], row["missing"]), ("a", 2, 1, ["R-2"]))

    def test_slug는_파일_이름에서_날짜와_확장자를_뺀다(self):
        self.spec_with_plan(spec="docs/specs/2026-10-15-foo-bar.md")
        self.write("scripts/test_a.py", f"# {self.ref('foo-bar', 1)}\n")
        self.assert_ok()
        self.assertEqual(self.report()[0]["slug"], "foo-bar")
        self.spec_with_plan(spec="docs/specs/baz.md")
        self.write("scripts/test_b.py", f"# {self.ref('baz', 2)}\n")
        self.assert_ok()

    def test_테스트_경로를_골라_읽는다(self):
        self.spec_with_plan(reqs="".join(f"- **R-{n}** 요구사항\n" for n in range(1, 8)))
        self.write("packages/x/src/test/java/XTest.java", f"// {self.ref('a', 1)}\nclass XTest {{}}\n")
        self.write("packages/y/src/lib/b.test.ts", f"it('b ({self.ref('a', 2)})', () => {{}})\n")
        self.write("packages/y/test-qa/c.mjs", f"// {self.ref('a', 3)}\n")
        self.write("packages/y/test/d.tsx", f"// {self.ref('a', 4)}\n")
        self.write("mcp/z/test_e.py", f'"""{self.ref("a", 5)}"""\n')
        self.write("scripts/test-f.sh", f"# {self.ref('a', 6)}\n")
        # 테스트가 아닌 코드, 빌드 결과, node_modules는 세지 않는다
        self.write("packages/x/src/main/java/X.java", f"// {self.ref('a', 7)}\n")
        self.write("packages/y/node_modules/k/test/g.test.js", f"// {self.ref('a', 7)}\n")
        self.write("packages/y/build/test/h.test.js", f"// {self.ref('a', 7)}\n")
        self.assert_ok()
        self.assertEqual(self.report()[0]["missing"], ["R-7"])

    def test_모두_연결되면_경고가_없다(self):
        self.spec_with_plan()
        self.write("scripts/test_a.py", f"# {self.ref('a', 1)}, {self.ref('a', 2)}\n")
        self.assertEqual(self.warnings(), [])
        self.assertEqual(self.report()[0]["missing"], [])

    def test_테스트가_없는_요구사항은_경고만(self):
        self.spec_with_plan()
        self.assert_ok()
        warnings = self.warnings()
        self.assertTrue(any("R-1" in w and "R-2" in w and "테스트" in w for w in warnings), warnings)

    def test_없는_spec을_인용하면_실패(self):
        self.spec_with_plan()
        self.write("scripts/test_a.py", f"# {self.ref('nope', 1)}\n")
        self.assert_error("`nope`")

    def test_테스트가_spec에_없는_ID를_인용하면_실패(self):
        self.spec_with_plan()
        self.write("scripts/test_a.py", f"# {self.ref('a', 3)}\n")
        self.assert_error("R-3")
        found = [(rel, line) for rel, line, message in check_docs.check(self.root) if "R-3" in message]
        self.assertEqual(found, [("scripts/test_a.py", 1)])

    def test_ID가_없거나_superseded인_spec을_인용하면_실패(self):
        self.write("docs/specs/2026-10-15-plain.md", SPEC.format(version="1", status="active") + "1. 첫째\n")
        self.write("docs/specs/2026-10-15-old.md", SPEC.format(version="1", status="superseded") + self.REQS)
        self.write("scripts/test_a.py", f"# {self.ref('plain', 1)}\n# {self.ref('old', 1)}\n")
        errors = self.errors()
        self.assertTrue(any("`plain`" in e for e in errors), errors)
        self.assertTrue(any("`old`" in e for e in errors), errors)

    def test_ID를_쓰는_spec끼리_slug가_같으면_실패(self):
        self.spec_with_plan()
        self.spec_with_plan(spec="services/shop/docs/specs/2026-10-16-a.md")
        self.assert_error("slug")

    def test_다른_글자에_붙은_인용은_읽지_않는다(self):
        # — 경로·URL 조각(`specs/a#R-1`)과 `R-12`·`R-1-2`의 `R-1`은 인용이 아니다
        self.spec_with_plan(reqs="- **R-1** 첫째\n- **R-12** 열둘째\n")
        self.write("scripts/test_a.py", f"# docs/specs/{self.ref('a', 1)} {self.ref('a', 12)} {self.ref('a', 1)}-2\n")
        self.assert_ok()
        self.assertEqual(self.report()[0]["missing"], ["R-1"])

    def test_ID가_없는_spec은_보고하지_않는다(self):
        # — 옵트인
        self.write("docs/specs/2026-10-15-plain.md", SPEC.format(version="1", status="active") + "1. 첫째\n")
        self.assert_ok()
        self.assertEqual(self.report(), [])
        self.assertEqual(self.warnings(), [])

    def test_보고서를_출력한다(self):
        self.spec_with_plan()
        self.write("scripts/test_a.py", f"# {self.ref('a', 1)}\n")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = check_docs.main(["check_docs.py", self.root])
        self.assertEqual(code, 0)
        text = out.getvalue()
        self.assertIn("2개 중 1개", text)
        self.assertIn("50%", text)
        self.assertIn("R-2", text)

    # 링크

    def test_깨진_링크(self):
        self.write("README.md", "[가이드](docs/none.md)\n")
        self.assert_error("깨진 링크")

    def test_살아있는_링크와_앵커(self):
        self.write("docs/a.md", "# A\n")
        self.write("README.md", "[A](docs/a.md#제목) [위](#위) [웹](https://x.y/z.md) [메일](mailto:a@b.c)\n")
        self.assert_ok()

    def test_코드_블록과_인라인_코드_안의_링크는_무시(self):
        self.write("README.md", "```md\n[x](none.md)\n```\n`[y](none2.md)`\n")
        self.assert_ok()

    def test_퍼센트_인코딩_링크(self):
        self.write("docs/새 문서.md", "# 새\n")
        self.write("README.md", "[새](docs/%EC%83%88%20%EB%AC%B8%EC%84%9C.md)\n")
        self.assert_ok()

    def test_frontmatter_sources의_깨진_상대경로(self):
        self.write("knowledge-base/decisions/0001-a.md",
                   ADR.format(id="0001", status="active", extra="").replace(
                       "  - https://example.com\n", "  - ../sources/none.md   # 설명\n"))
        self.assert_error("깨진 링크")


if __name__ == "__main__":
    unittest.main(verbosity=1)
