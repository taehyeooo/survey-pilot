#!/usr/bin/env python3
"""check_context.py 테스트. 사용: python3 scripts/test_check_context.py
규칙을 바꾸면 여기에 사례를 먼저 추가한다(ADR 0013).
"""

import os
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_context  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

GOOD_RULE = """---
paths:
  - "**/*.java"
  - "docs/**"
---

# 자바 규칙

- 근거는 [ADR](../../docs/adr.md).
"""

GOOD_CLAUDE = """# 레포

- [java.md](.claude/rules/java.md) — 자바
"""


def write(root, rel, text):
    path = os.path.join(root, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


class Fixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        write(self.root, "CLAUDE.md", GOOD_CLAUDE)
        write(self.root, ".claude/rules/java.md", GOOD_RULE)
        write(self.root, "docs/adr.md", "# adr\n")
        write(self.root, "src/A.java", "class A {}\n")

    def tearDown(self):
        self.tmp.cleanup()

    def errors(self):
        return check_context.check(self.root)

    def assertOneError(self, needle):
        errors = self.errors()
        self.assertEqual(len(errors), 1, errors)
        self.assertIn(needle, errors[0][2])
        return errors[0]


class CheckTest(Fixture):
    def test_올바른_레포는_통과(self):
        self.assertEqual(self.errors(), [])

    def test_CLAUDE_md_200줄은_통과_201줄은_실패(self):
        lines = GOOD_CLAUDE.splitlines()
        write(self.root, "CLAUDE.md", "\n".join(lines + ["-"] * (200 - len(lines))) + "\n")
        self.assertEqual(self.errors(), [])
        write(self.root, "CLAUDE.md", "\n".join(lines + ["-"] * (201 - len(lines))) + "\n")
        rel, _, _ = self.assertOneError("201줄")
        self.assertEqual(rel, "CLAUDE.md")

    def test_CLAUDE_md가_없으면_실패(self):
        os.remove(os.path.join(self.root, "CLAUDE.md"))
        self.assertTrue(any("CLAUDE.md가 없다" in e[2] for e in self.errors()))

    def test_frontmatter가_없는_규칙은_실패(self):
        write(self.root, ".claude/rules/java.md", "# 자바 규칙\n\n---\n")
        self.assertOneError("frontmatter가 없다")

    def test_닫히지_않은_frontmatter는_실패(self):
        write(self.root, ".claude/rules/java.md", "---\npaths:\n  - \"**/*.java\"\n# 자바\n")
        self.assertOneError("닫히지 않았다")

    def test_paths가_없는_규칙은_실패(self):
        write(self.root, ".claude/rules/java.md", "---\ntitle: 자바\n---\n# 자바\n")
        self.assertOneError("paths")

    def test_paths가_빈_목록이면_실패(self):
        write(self.root, ".claude/rules/java.md", "---\npaths:\n---\n# 자바\n")
        self.assertOneError("paths")

    def test_paths가_목록이_아닌_문자열이면_실패(self):
        write(self.root, ".claude/rules/java.md", "---\npaths: \"**/*.java\"\n---\n# 자바\n")
        self.assertOneError("YAML 목록")

    def test_빈_패턴은_실패(self):
        write(self.root, ".claude/rules/java.md", "---\npaths:\n  - \"\"\n---\n# 자바\n")
        self.assertOneError("빈 패턴")

    def test_아무_파일에도_맞지_않는_패턴은_실패(self):
        write(self.root, ".claude/rules/java.md",
              GOOD_RULE.replace('  - "docs/**"\n', '  - "docs/**"\n  - "**/*.kt"\n'))
        rel, line, message = self.assertOneError("**/*.kt")
        self.assertEqual((rel, line), (".claude/rules/java.md", 5))

    def test_닫히지_않은_괄호_패턴은_실패(self):
        write(self.root, ".claude/rules/java.md",
              GOOD_RULE.replace('"docs/**"', '"docs/[2024/**"'))
        self.assertIn("docs/[2024/**", self.assertOneError("잘못된 글롭")[2])
        self.assertIsNone(check_context.glob_regex("src/{a,b"))

    def test_하위_폴더의_규칙도_검사(self):
        write(self.root, ".claude/rules/front/web.md", "# 웹\n")
        write(self.root, "CLAUDE.md", GOOD_CLAUDE + "- [web](.claude/rules/front/web.md)\n")
        rel, _, _ = self.assertOneError("frontmatter가 없다")
        self.assertEqual(rel, ".claude/rules/front/web.md")

    def test_md가_아닌_파일은_보지_않음(self):
        write(self.root, ".claude/rules/notes.txt", "아무거나\n")
        self.assertEqual(self.errors(), [])

    def test_CLAUDE_md가_링크하지_않은_규칙은_실패(self):
        write(self.root, "CLAUDE.md", "# 레포\n")
        self.assertOneError("링크")

    def test_CLAUDE_md의_깨진_링크는_실패(self):
        write(self.root, "CLAUDE.md", GOOD_CLAUDE + "- [없음](docs/none.md)\n")
        rel, line, _ = self.assertOneError("깨진 링크")
        self.assertEqual((rel, line), ("CLAUDE.md", 4))

    def test_규칙_파일의_깨진_링크는_실패(self):
        write(self.root, ".claude/rules/java.md", GOOD_RULE.replace("docs/adr.md", "docs/none.md"))
        self.assertOneError("깨진 링크")

    def test_코드_블록과_인라인_코드와_외부_링크는_보지_않음(self):
        write(self.root, "CLAUDE.md", GOOD_CLAUDE
              + "`[x](none.md)` [web](https://example.com) [앵커](#레포)\n```\n[y](none.md)\n```\n")
        self.assertEqual(self.errors(), [])


class GlobTest(unittest.TestCase):
    def match(self, pattern, path):
        return check_context.glob_match(pattern, path)

    def test_두_별은_0개_이상_폴더(self):
        self.assertTrue(self.match("**/*.gradle", "settings.gradle"))
        self.assertTrue(self.match("**/*.gradle", "packages/a/build.gradle"))
        self.assertTrue(self.match("packages/**", "packages/a/b/c.ts"))
        self.assertTrue(self.match("docs/**/x.md", "docs/x.md"))
        self.assertFalse(self.match("packages/**", "services/a.java"))

    def test_한_별은_폴더를_넘지_않음(self):
        self.assertTrue(self.match("*.md", "CLAUDE.md"))
        self.assertFalse(self.match("*.md", "docs/a.md"))
        self.assertTrue(self.match("packages/*-starter/**", "packages/auth-starter/build.gradle"))
        self.assertFalse(self.match("packages/*-starter/**", "packages/design/x.ts"))

    def test_중괄호와_물음표(self):
        self.assertTrue(self.match("src/**/*.{ts,tsx}", "src/a/b.tsx"))
        self.assertTrue(self.match("src/**/*.{ts,tsx}", "src/b.ts"))
        self.assertFalse(self.match("src/**/*.{ts,tsx}", "src/b.js"))
        self.assertTrue(self.match("a?.md", "ab.md"))
        self.assertFalse(self.match("a?.md", "a/.md"))

    def test_점은_글자_그대로(self):
        self.assertFalse(self.match("*.md", "amd"))


class CliTest(unittest.TestCase):
    def run_cli(self, root):
        # CI(GITHUB_ACTIONS=true)에서는 출력이 ::error 형식이라, 여기서는 로컬 형식으로 고정한다
        env = {k: v for k, v in os.environ.items() if k != "GITHUB_ACTIONS"}
        return subprocess.run([sys.executable, os.path.join(HERE, "check_context.py"), root],
                              capture_output=True, text=True, encoding="utf-8", env=env)

    def test_종료_코드와_출력(self):
        with tempfile.TemporaryDirectory() as root:
            write(root, "CLAUDE.md", "# 레포\n")
            write(root, ".claude/rules/a.md", "# a\n")
            result = self.run_cli(root)
            self.assertEqual(result.returncode, 1)
            self.assertIn(".claude/rules/a.md:1:", result.stdout)
            write(root, ".claude/rules/a.md", "---\npaths:\n  - \"*.md\"\n---\n# a\n")
            write(root, "CLAUDE.md", "# 레포\n[a](.claude/rules/a.md)\n")
            result = self.run_cli(root)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_이_레포는_통과(self):
        result = self.run_cli(REPO)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
