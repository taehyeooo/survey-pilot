#!/usr/bin/env python3
"""머지가 끝난 작업의 워크트리·브랜치 정리 (merge-train 4번).

사용: python scripts/cleanup_worktree.py <워크트리 경로 또는 브랜치> [--remote] [--no-pr-check]
      예: python scripts/cleanup_worktree.py ../myapp-login
          python scripts/cleanup_worktree.py "feat/#12-login" --remote

- 멈추는 경우(아무것도 지우지 않음): 메인 체크아웃, 지금 서 있는 워크트리, 등록된 워크트리가 아닌 경로,
  커밋 안 한 변경, 그 브랜치의 PR이 MERGED가 아님(gh로 확인 — squash 머지라 git으로는 머지 여부를 알 수 없다).
- `git worktree remove`가 실패하면(Windows 경로 260자 — node_modules 등) 그 워크트리 폴더 하나만
  긴 경로 이름(`\\\\?\\`)으로 지우고 `git worktree prune`. 읽기 전용 파일도 지운다.
- 로컬 브랜치는 `git branch -D`(squash 머지라 -d는 "안 머지됨"으로 거부한다). --remote면 원격 브랜치도.
"""

import argparse
import json
import ntpath
import os
import shutil
import stat
import subprocess
import sys


def run(cmd, cwd=None):
    """(종료 코드, 출력+오류)."""
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip()


def gh_pr_state(branch):
    """그 브랜치의 PR 상태(MERGED·OPEN·CLOSED). PR이 없으면 None. gh가 없거나 실패하면 예외."""
    code, out = run(["gh", "pr", "list", "--state", "all", "--head", branch, "--json", "state", "--limit", "1"])
    if code != 0:
        raise RuntimeError(f"gh로 PR을 확인하지 못했다: {out[:200]}")
    prs = json.loads(out or "[]")
    return prs[0]["state"] if prs else None


def long_path(path, windows=os.name == "nt"):
    """Windows는 `\\\\?\\` 접두어로 260자 제한을 넘는다(절대 경로에만 붙는다)."""
    if not windows or path.startswith("\\\\?\\"):
        return path
    return "\\\\?\\" + ntpath.abspath(path)  # Windows 경로 규칙으로 — 다른 OS에서 도는 테스트에서도 같게


def force_writable(func, path, _exc):
    """shutil.rmtree onerror — 읽기 전용 파일(.git 객체·node_modules)을 쓰기 가능으로 바꿔 다시 지운다."""
    os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    func(path)


def worktrees(main, run=run):
    """[{path, branch}] — 첫 항목이 메인 체크아웃."""
    code, out = run(["git", "worktree", "list", "--porcelain"], cwd=main)
    if code != 0:
        raise RuntimeError(out)
    found, cur = [], {}
    for line in out.splitlines() + [""]:
        if line.startswith("worktree "):
            cur = {"path": os.path.abspath(line[len("worktree "):]), "branch": None}  # 비교는 same()·inside()에서
        elif line.startswith("branch "):
            cur["branch"] = line[len("branch "):].removeprefix("refs/heads/")
        elif not line and cur:
            found.append(cur)
            cur = {}
    return found


def same(a, b):
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def inside(path, folder):
    path, folder = os.path.normcase(os.path.abspath(path)), os.path.normcase(os.path.abspath(folder))
    return path == folder or path.startswith(folder.rstrip(os.sep) + os.sep)


def cleanup(main, target, remote=False, pr_state=gh_pr_state, cwd=None, run=run):
    """(성공 여부, 한국어 메시지). pr_state=None이면 PR 확인을 건너뛴다."""
    wts = worktrees(main, run)
    entry = next((w for w in wts if same(w["path"], target) or w["branch"] == target), None)
    if entry is None:
        return False, f"{target} — 이 저장소에 등록된 워크트리가 아니다(git worktree list)"
    if same(entry["path"], wts[0]["path"]):
        return False, "메인 체크아웃은 지우지 않는다"
    if inside(cwd or os.getcwd(), entry["path"]):
        return False, "지금 서 있는 워크트리는 지울 수 없다 — 메인 체크아웃에서 다시 돌린다"
    path, branch = entry["path"], entry["branch"]

    code, out = run(["git", "status", "--porcelain"], cwd=path)
    if code != 0 or out:
        return False, f"커밋 안 한 변경이 있어 멈췄다 — {path}\n{out}"
    if pr_state is not None and branch:
        try:
            state = pr_state(branch)
        except Exception as e:  # gh 없음·네트워크 — 머지 여부를 모르면 지우지 않는다
            return False, f"{e} — 확인 없이 지우려면 --no-pr-check"
        if state != "MERGED":
            return False, f"{branch}의 PR이 " + (f"{state} — 머지된 것만 지운다" if state else "없다 — 머지된 것만 지운다")

    notes = []
    code, out = run(["git", "worktree", "remove", path], cwd=main)
    if code != 0:
        # 그 워크트리 폴더 하나만, 등록된 경로 그대로 — 빈 값·메인 체크아웃이 아님은 위에서 확인했다
        shutil.rmtree(long_path(path), onerror=force_writable)
        run(["git", "worktree", "prune"], cwd=main)
        notes.append(f"git worktree remove 실패({out.splitlines()[-1] if out else '이유 없음'}) → 긴 경로 이름으로 폴더를 지우고 prune")
    if os.path.exists(path):
        return False, f"폴더가 남았다 — {path}"
    if branch:
        code, out = run(["git", "branch", "-D", branch], cwd=main)
        notes.append(f"로컬 브랜치 {branch} 지움" if code == 0 else f"로컬 브랜치를 못 지웠다: {out}")
        if remote:
            code, out = run(["git", "push", "origin", "--delete", branch], cwd=main)
            notes.append(f"원격 브랜치 {branch} 지움" if code == 0 else f"원격 브랜치를 못 지웠다: {out}")
    return True, f"워크트리 지움 — {path}" + "".join(f"\n- {n}" for n in notes)


def main_checkout(start):
    """어느 워크트리에서 돌려도 메인 체크아웃(공통 .git의 부모)을 찾는다."""
    code, out = run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=start)
    if code != 0:
        raise SystemExit("git 저장소 안에서 돌린다")
    return os.path.dirname(out.strip())


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="머지가 끝난 작업의 워크트리·브랜치 정리")
    parser.add_argument("target", help="워크트리 경로 또는 브랜치 이름")
    parser.add_argument("--remote", action="store_true", help="원격 브랜치도 지운다")
    parser.add_argument("--no-pr-check", action="store_true", help="PR 머지 확인을 건너뛴다(gh가 없을 때)")
    args = parser.parse_args(argv[1:])
    ok, message = cleanup(main_checkout(os.getcwd()), args.target, remote=args.remote,
                          pr_state=None if args.no_pr_check else gh_pr_state)
    print(message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
