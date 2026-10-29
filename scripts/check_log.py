#!/usr/bin/env python3
"""작업 기록(knowledge-base/log.md) 검사 (ADR 0010)

사용: python3 scripts/check_log.py <base> <head>   (git 커밋·브랜치)

  1. PR이 log.md를 바꾸지 않았으면 **경고**한다(실패는 아님). 작업이 끝나면 기록을 남긴다는 규칙을 잊지 않게.
  2. log.md의 기존 줄을 고치거나 지웠으면 **실패**한다. log.md는 append-only다.
     (파일 끝 줄바꿈만 붙어서 같은 줄이 지워졌다 다시 생긴 것은 수정으로 보지 않는다)
  3. 새로 더한 줄(`- 한 것: ...` 등)이 ENTRY_LINE_LIMIT자를 넘으면 **경고**한다(ADR 0010).
     긴 확인 내용은 PR 본문에 두고 log에는 요약만 남긴다.
"""

import os
import subprocess
import sys
from collections import Counter

LOG = "knowledge-base/log.md"
ENTRY_LINE_LIMIT = 300  # 새로 더한 줄 한 줄의 권장 최대 글자 수(ADR 0010)


def analyze(changed_files, log_diff):
    """(경고 목록, 오류 목록)을 돌려준다. log_diff는 `git diff -U0` 출력."""
    warnings, errors = [], []
    if LOG not in changed_files:
        warnings.append(f"이 PR은 {LOG}를 갱신하지 않았다. 작업 기록(한 것·확인한 것·확인하지 않은 것·남긴 지식)을 남겼는지 확인한다.")
        return warnings, errors

    removed, added = Counter(), Counter()
    for line in log_diff.splitlines():
        if line.startswith(("---", "+++")):
            continue
        if line.startswith("-"):
            removed[line[1:]] += 1
        elif line.startswith("+"):
            added[line[1:]] += 1
    changed = removed - added  # 다시 그대로 생긴 줄(끝 줄바꿈 차이)은 뺀다
    for text in changed.elements():
        errors.append(f"{LOG}의 기존 줄이 바뀌거나 지워졌다(append-only) → `{text}`. 틀렸으면 새 항목으로 정정한다.")
    for text in (added - removed).elements():
        if len(text) > ENTRY_LINE_LIMIT:
            warnings.append(f"{LOG} 새 항목 줄이 {len(text)}자다(권장 {ENTRY_LINE_LIMIT}자 이하) → `{text[:40]}…`. "
                            "자세한 확인 내용(명령·개수·변형 시험)은 PR 본문에 두고, log에는 요약과 PR 번호만 남긴다.")
    return warnings, errors


def git(*args):
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True, encoding="utf-8").stdout


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    if len(argv) != 3:
        print("사용: check_log.py <base> <head>", file=sys.stderr)
        return 2
    base, head = argv[1], argv[2]
    changed = git("diff", "--name-only", f"{base}...{head}").split()
    log_diff = git("diff", "-U0", f"{base}...{head}", "--", LOG)
    warnings, errors = analyze(changed, log_diff)

    github = os.environ.get("GITHUB_ACTIONS") == "true"
    for message in warnings:
        print(f"::warning file={LOG}::{message}" if github else f"경고: {message}")
    for message in errors:
        print(f"::error file={LOG}::{message}" if github else f"오류: {message}")

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary and (warnings or errors):
        with open(summary, "a", encoding="utf-8") as f:
            f.write("### 작업 기록 검사\n\n")
            for message in errors:
                f.write(f"- 오류: {message}\n")
            for message in warnings:
                f.write(f"- 경고: {message}\n")

    if not warnings and not errors:
        print("작업 기록 검사 통과")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
