#!/usr/bin/env python3
"""cleanup_worktree.py 테스트. 사용: python3 scripts/test_cleanup_worktree.py"""

import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cleanup_worktree  # noqa: E402


def git(cwd, *args):
    return subprocess.run(["git", "-C", cwd, *args], check=True, capture_output=True, text=True).stdout


def merged(branch):
    return "MERGED"


class CleanupWorktreeTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.main = os.path.join(self.tmp, "repo")
        os.makedirs(self.main)
        git(self.main, "init", "-q", "-b", "main")
        with open(os.path.join(self.main, "a.txt"), "w") as f:
            f.write("a\n")
        with open(os.path.join(self.main, ".gitignore"), "w") as f:
            f.write("node_modules/\n")  # 레포처럼 — 무시되는 폴더는 "커밋 안 한 변경"이 아니다
        git(self.main, "add", ".")
        git(self.main, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x")
        self.wt = os.path.join(self.tmp, "repo-feature")
        git(self.main, "worktree", "add", "-q", self.wt, "-b", "feat/#1-x")

    def tearDown(self):
        shutil.rmtree(self.tmp, onerror=cleanup_worktree.force_writable)

    def branches(self):
        return git(self.main, "branch", "--format=%(refname:short)").split()

    def run_cleanup(self, target, **kw):
        kw.setdefault("pr_state", merged)
        return cleanup_worktree.cleanup(self.main, target, **kw)

    def test_머지된_워크트리를_지우고_브랜치도_지운다(self):
        ok, message = self.run_cleanup(self.wt)
        self.assertTrue(ok, message)
        self.assertFalse(os.path.exists(self.wt))
        self.assertNotIn("feat/#1-x", self.branches())
        self.assertNotIn("repo-feature", git(self.main, "worktree", "list"))

    def test_브랜치_이름으로도_찾는다(self):
        ok, message = self.run_cleanup("feat/#1-x")
        self.assertTrue(ok, message)
        self.assertFalse(os.path.exists(self.wt))

    def test_커밋_안_한_변경이_있으면_멈춘다(self):
        with open(os.path.join(self.wt, "b.txt"), "w") as f:
            f.write("b\n")
        ok, message = self.run_cleanup(self.wt)
        self.assertFalse(ok)
        self.assertIn("커밋 안 한 변경", message)
        self.assertIn("b.txt", message)
        self.assertTrue(os.path.exists(self.wt))
        self.assertIn("feat/#1-x", self.branches())

    def test_PR이_머지되지_않았으면_멈춘다(self):
        for state, word in (("OPEN", "OPEN"), ("CLOSED", "CLOSED"), (None, "PR이 없다")):
            ok, message = self.run_cleanup(self.wt, pr_state=lambda b, s=state: s)
            self.assertFalse(ok, state)
            self.assertIn(word, message)
            self.assertTrue(os.path.exists(self.wt))

    def test_PR_확인을_건너뛸_수_있다(self):
        ok, message = self.run_cleanup(self.wt, pr_state=None)
        self.assertTrue(ok, message)

    def test_메인_체크아웃과_모르는_경로는_거부(self):
        ok, message = self.run_cleanup(self.main)
        self.assertFalse(ok)
        self.assertIn("메인 체크아웃", message)
        self.assertTrue(os.path.exists(os.path.join(self.main, "a.txt")))
        ok, message = self.run_cleanup(os.path.join(self.tmp, "nope"))
        self.assertFalse(ok)
        self.assertIn("워크트리가 아니다", message)

    def test_지금_서_있는_워크트리는_거부(self):
        ok, message = self.run_cleanup(self.wt, cwd=os.path.join(self.wt))
        self.assertFalse(ok)
        self.assertIn("지금 서 있는", message)
        self.assertTrue(os.path.exists(self.wt))

    def test_worktree_remove가_실패하면_폴더를_지우고_prune(self):
        # node_modules 긴 경로처럼 git이 못 지우는 경우를 흉내 낸다
        deep = os.path.join(self.wt, *["node_modules"] * 25, "pkg")
        self.assertGreater(len(deep), 300)  # Windows 260자 제한을 넘는다
        os.makedirs(cleanup_worktree.long_path(deep))
        locked = cleanup_worktree.long_path(os.path.join(deep, "x.js"))
        with open(locked, "w") as f:
            f.write("x")
        os.chmod(locked, stat.S_IREAD)
        real = cleanup_worktree.run

        def fail_remove(cmd, cwd=None):
            if cmd[:3] == ["git", "worktree", "remove"]:
                return 1, "Filename too long"
            return real(cmd, cwd)

        ok, message = self.run_cleanup(self.wt, run=fail_remove)
        self.assertTrue(ok, message)
        self.assertIn("긴 경로", message)
        self.assertFalse(os.path.exists(self.wt))
        self.assertNotIn("repo-feature", git(self.main, "worktree", "list"))
        self.assertNotIn("feat/#1-x", self.branches())

    def test_remote면_원격_브랜치도_지운다(self):
        origin = os.path.join(self.tmp, "origin.git")
        git(self.tmp, "init", "-q", "--bare", origin)
        git(self.main, "remote", "add", "origin", origin)
        git(self.main, "push", "-q", "origin", "main", "feat/#1-x")
        ok, message = self.run_cleanup(self.wt, remote=True)
        self.assertTrue(ok, message)
        self.assertNotIn("feat/#1-x", git(origin, "branch", "--format=%(refname:short)").split())
        self.assertIn("main", git(origin, "branch", "--format=%(refname:short)").split())

    def test_긴_경로_이름은_윈도에서만_붙인다(self):
        self.assertEqual(cleanup_worktree.long_path(r"C:\a\b", windows=True), "\\\\?\\C:\\a\\b")
        self.assertEqual(cleanup_worktree.long_path("/a/b", windows=False), "/a/b")


if __name__ == "__main__":
    unittest.main(verbosity=1)
