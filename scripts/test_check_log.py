#!/usr/bin/env python3
"""check_log.py 테스트. 사용: python3 scripts/test_check_log.py
규칙을 바꾸면 여기에 사례를 먼저 추가한다.
"""

import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_log  # noqa: E402

LOG = check_log.LOG

APPEND_DIFF = """diff --git a/knowledge-base/log.md b/knowledge-base/log.md
--- a/knowledge-base/log.md
+++ b/knowledge-base/log.md
@@ -20,0 +21,3 @@
+
+## 2026-10-14 새 작업 (#9)
+- 한 것: 무엇
"""

EDIT_DIFF = """--- a/knowledge-base/log.md
+++ b/knowledge-base/log.md
@@ -5 +5 @@
-- 한 것: 처음 쓴 내용
+- 한 것: 고친 내용
"""

DELETE_DIFF = """--- a/knowledge-base/log.md
+++ b/knowledge-base/log.md
@@ -5,2 +4,0 @@
-## 2026-10-13 지운 항목
-- 한 것: 무엇
"""

NO_NEWLINE_DIFF = """--- a/knowledge-base/log.md
+++ b/knowledge-base/log.md
@@ -9 +9,3 @@
-- 남긴 지식: 없음
\\ No newline at end of file
+- 남긴 지식: 없음
+
+## 2026-10-14 새 작업
"""


class AnalyzeTest(unittest.TestCase):
    def test_log를_안_바꾸면_경고만(self):
        warnings, errors = check_log.analyze(["README.md"], "")
        self.assertEqual(len(warnings), 1)
        self.assertEqual(errors, [])

    def test_끝에_추가만_하면_통과(self):
        self.assertEqual(check_log.analyze([LOG, "README.md"], APPEND_DIFF), ([], []))

    def test_기존_줄_수정은_실패(self):
        warnings, errors = check_log.analyze([LOG], EDIT_DIFF)
        self.assertEqual(warnings, [])
        self.assertEqual(len(errors), 1)
        self.assertIn("처음 쓴 내용", errors[0])

    def test_기존_항목_삭제는_실패(self):
        _, errors = check_log.analyze([LOG], DELETE_DIFF)
        self.assertEqual(len(errors), 2)

    def test_끝_줄바꿈만_붙은_것은_수정_아님(self):
        self.assertEqual(check_log.analyze([LOG], NO_NEWLINE_DIFF), ([], []))

    # 새 항목 길이 (ADR 0010) — 경고만

    def long_diff(self, n, prefix="- 확인한 것: "):
        return APPEND_DIFF + "+" + prefix + "가" * (n - len(prefix)) + "\n"

    def test_새_항목_줄이_길면_경고만(self):
        warnings, errors = check_log.analyze([LOG], self.long_diff(check_log.ENTRY_LINE_LIMIT + 1))
        self.assertEqual(errors, [])
        self.assertEqual(len(warnings), 1)
        self.assertIn("PR 본문", warnings[0])
        self.assertIn(f"{check_log.ENTRY_LINE_LIMIT + 1}자", warnings[0])

    def test_한도까지는_경고하지_않는다(self):
        self.assertEqual(check_log.analyze([LOG], self.long_diff(check_log.ENTRY_LINE_LIMIT)), ([], []))

    def test_네_칸_밖의_목록_줄도_본다(self):
        warnings, _ = check_log.analyze([LOG], self.long_diff(check_log.ENTRY_LINE_LIMIT + 1, "- 참고: "))
        self.assertEqual(len(warnings), 1)

    def test_기존_긴_줄이_끝_줄바꿈으로_다시_생기면_경고하지_않는다(self):
        line = "- 한 것: " + "가" * check_log.ENTRY_LINE_LIMIT
        diff = (f"--- a/{LOG}\n+++ b/{LOG}\n@@ -9 +9,3 @@\n-{line}\n\\ No newline at end of file\n"
                f"+{line}\n+\n+## 새\n")
        self.assertEqual(check_log.analyze([LOG], diff), ([], []))


class GitIntegrationTest(unittest.TestCase):
    """실제 git 저장소에서 base...head 비교가 맞게 되는지."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.com")
        self.git("config", "user.name", "t")
        self.git("config", "core.hooksPath", os.devnull)  # 레포 훅이 끼지 않게
        self.write(LOG, "# 기록\n\n## 첫 항목\n- 한 것: 처음\n")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "docs: 시작")
        self.git("checkout", "-q", "-b", "work")

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.dir, check=True, capture_output=True, text=True).stdout

    def write(self, rel, text):
        path = os.path.join(self.dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)

    def run_check(self):
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_log.py")
        # CI 안에서 돌 때도 로컬 출력 형식으로 검사한다(GitHub 주석 형식·작업 요약 파일 쓰기 끔)
        env = {k: v for k, v in os.environ.items() if k not in ("GITHUB_ACTIONS", "GITHUB_STEP_SUMMARY")}
        result = subprocess.run([sys.executable, script, "main", "work"], cwd=self.dir, env=env,
                                capture_output=True, text=True, encoding="utf-8")
        return result.returncode, result.stdout

    def commit(self):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "docs: 작업")

    def test_추가하면_통과(self):
        self.write(LOG, "# 기록\n\n## 첫 항목\n- 한 것: 처음\n\n## 둘째 항목\n- 한 것: 다음\n")
        self.commit()
        code, out = self.run_check()
        self.assertEqual(code, 0)
        self.assertIn("통과", out)

    def test_log를_안_바꾸면_경고하고_통과(self):
        self.write("README.md", "# 안내\n")
        self.commit()
        code, out = self.run_check()
        self.assertEqual(code, 0)
        self.assertIn("경고", out)

    def test_긴_새_항목은_경고하고_통과(self):
        self.write(LOG, "# 기록\n\n## 첫 항목\n- 한 것: 처음\n\n## 둘째\n- 한 것: " + "가" * 400 + "\n")
        self.commit()
        code, out = self.run_check()
        self.assertEqual(code, 0)
        self.assertIn("경고", out)

    def test_기존_줄을_고치면_실패(self):
        self.write(LOG, "# 기록\n\n## 첫 항목\n- 한 것: 고침\n")
        self.commit()
        code, out = self.run_check()
        self.assertEqual(code, 1)
        self.assertIn("append-only", out)


if __name__ == "__main__":
    unittest.main(verbosity=1)
