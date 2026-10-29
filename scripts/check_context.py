#!/usr/bin/env python3
"""AI 컨텍스트 파일 검사 (ADR 0013)

사용: python3 scripts/check_context.py [레포 루트]   (기본: 현재 폴더)

검사
  1. CLAUDE.md는 200줄 이하 — 매 세션 통째로 읽히는 파일이라(공식 문서 권고 "200줄 아래")
  2. `.claude/rules/` 아래 모든 .md(하위 폴더 포함)에 frontmatter `paths:`가 YAML 목록으로 있고,
     패턴마다 비어 있지 않으며 레포 파일 하나 이상에 맞는가
     (Claude Code는 paths가 없거나 frontmatter를 못 읽으면 그 규칙을 매 세션 항상 읽는다 — 조용히 CLAUDE.md가 길어지는 셈)
  3. CLAUDE.md가 규칙 파일마다 링크하는가 — 경로를 아직 안 열었어도 무엇이 있는지 알게
  4. CLAUDE.md와 규칙 파일의 깨진 상대 링크

글롭은 `**`(0개 이상 폴더), `*`·`?`(폴더 경계를 넘지 않음), `{a,b}`, `[...]`를 지원한다.
외부 패키지 없이 표준 라이브러리만 쓴다.
"""

import os
import re
import subprocess
import sys
from urllib.parse import unquote

MAX_LINES = 200
RULES_DIR = ".claude/rules"
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "_code-map", ".obsidian",
             "build", "dist", "out", ".next", ".gradle"}

LINK_RE = re.compile(r"\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
INLINE_CODE_RE = re.compile(r"`[^`]*`")


def glob_regex(pattern):
    """글롭을 정규식으로. 잘못된 패턴(닫히지 않은 [ 또는 {)이면 None."""
    out, i, n, depth = [], 0, len(pattern), 0
    while i < n:
        c = pattern[i]
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif c == "*":
            out.append("[^/]*")
            i += 1
        elif c == "?":
            out.append("[^/]")
            i += 1
        elif c == "[":
            end = pattern.find("]", i + 2 if pattern[i + 1:i + 2] in ("!", "^", "]") else i + 1)
            if end < 0 or "/" in pattern[i:end]:
                return None
            body = pattern[i + 1:end]
            if body[:1] in ("!", "^"):
                body = "^" + body[1:]
            out.append("[" + body.replace("\\", "\\\\") + "]")
            i = end + 1
        elif c == "\\" and i + 1 < n:
            out.append(re.escape(pattern[i + 1]))
            i += 2
        elif c == "{":
            depth += 1
            out.append("(?:")
            i += 1
        elif c == "}" and depth:
            depth -= 1
            out.append(")")
            i += 1
        elif c == "," and depth:
            out.append("|")
            i += 1
        else:
            out.append(re.escape(c))
            i += 1
    if depth:
        return None
    return re.compile("".join(out) + r"\Z")


def glob_match(pattern, path):
    regex = glob_regex(pattern)
    return bool(regex and regex.match(path))


def repo_files(root):
    """레포 파일(레포 루트 기준 / 경로). git이면 추적 + 무시되지 않은 새 파일, 아니면 폴더를 돈다."""
    try:
        result = subprocess.run(
            ["git", "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
            capture_output=True, check=True)
        top = subprocess.run(["git", "-C", root, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, check=True).stdout.strip()
        if os.path.normcase(os.path.abspath(top)) == os.path.normcase(os.path.abspath(root)):
            files = [p for p in result.stdout.decode("utf-8").split("\0") if p]
            return [p for p in files if os.path.exists(os.path.join(root, p))]
    except (OSError, subprocess.CalledProcessError):
        pass
    files = []
    for base, dirs, names in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(names):
            files.append(os.path.relpath(os.path.join(base, name), root).replace(os.sep, "/"))
    return files


def read_lines(path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def unquote_value(value):
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_paths(lines):
    """frontmatter의 paths. (오류 메시지, 줄) 또는 ([(줄, 패턴)], None)."""
    if not lines or lines[0].strip() != "---":
        return "frontmatter가 없다 — 첫 줄이 `---`이고 `paths:` 목록이 있어야 한다(없으면 매 세션 항상 읽힌다)", 1
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
    if end is None:
        return "frontmatter가 `---`로 닫히지 않았다(Claude Code는 이때 paths를 무시하고 항상 읽는다)", 1
    meta = lines[1:end]
    start = next((i for i, line in enumerate(meta) if re.match(r"^paths\s*:", line)), None)
    if start is None:
        return "frontmatter에 `paths:`가 없다(없으면 매 세션 항상 읽힌다)", 1
    inline = meta[start].split(":", 1)[1].strip()
    if inline:
        return "`paths:`는 YAML 목록(`  - \"패턴\"`)으로 쓴다", start + 2
    patterns = []
    for i in range(start + 1, len(meta)):
        item = re.match(r"^\s+-\s*(.*)$", meta[i])
        if not item:
            if meta[i].strip() and not meta[i].startswith((" ", "\t")):
                break
            continue
        patterns.append((i + 2, unquote_value(item.group(1))))
    if not patterns:
        return "`paths:` 목록이 비었다", start + 2
    return patterns, None


def check_links(root, rel, lines, errors):
    folder = os.path.dirname(os.path.join(root, rel))
    targets = []
    in_fence = False
    for no, line in enumerate(lines, 1):
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK_RE.findall(INLINE_CODE_RE.sub("", line)):
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            file_part = unquote(target.split("#", 1)[0])
            if not file_part:
                continue
            resolved = os.path.normpath(os.path.join(folder, file_part))
            if os.path.exists(resolved):
                targets.append(os.path.normcase(resolved))
            else:
                errors.append((rel, no, f"깨진 링크 → `{target}`"))
    return targets


def rule_files(root):
    base = os.path.join(root, *RULES_DIR.split("/"))
    found = []
    for folder, dirs, names in os.walk(base):
        dirs.sort()
        for name in sorted(names):
            if name.endswith(".md"):
                found.append(os.path.relpath(os.path.join(folder, name), root).replace(os.sep, "/"))
    return found


def check(root):
    errors = []
    claude = os.path.join(root, "CLAUDE.md")
    linked = []
    if not os.path.exists(claude):
        errors.append(("CLAUDE.md", 1, "CLAUDE.md가 없다"))
    else:
        lines = read_lines(claude)
        if len(lines) > MAX_LINES:
            errors.append(("CLAUDE.md", MAX_LINES + 1,
                           f"CLAUDE.md가 {len(lines)}줄이다 — {MAX_LINES}줄 이하로, 경로별 내용은 `.claude/rules/`로 옮긴다"))
        linked = check_links(root, "CLAUDE.md", lines, errors)

    files = None
    for rel in rule_files(root):
        lines = read_lines(os.path.join(root, rel))
        result, line = parse_paths(lines)
        if line is not None:
            errors.append((rel, line, result))
        else:
            if files is None:
                files = repo_files(root)
            for no, pattern in result:
                if not pattern:
                    errors.append((rel, no, "빈 패턴"))
                elif glob_regex(pattern) is None:
                    errors.append((rel, no, f"잘못된 글롭 `{pattern}`(닫히지 않은 [ 또는 {{)"))
                elif not any(glob_match(pattern, f) for f in files):
                    errors.append((rel, no, f"`{pattern}`에 맞는 파일이 없다(오타이거나 아직 없는 경로 — 생기면 넣는다)"))
        check_links(root, rel, lines, errors)
        if os.path.normcase(os.path.normpath(os.path.join(root, rel))) not in linked:
            errors.append((rel, 1, "CLAUDE.md가 이 규칙 파일을 링크하지 않는다"))
    return errors


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    root = os.path.abspath(argv[1] if len(argv) > 1 else ".")
    errors = check(root)
    github = os.environ.get("GITHUB_ACTIONS") == "true"
    for rel, line, message in errors:
        if github:
            print(f"::error file={rel},line={line}::{message}")
        else:
            print(f"{rel}:{line}: {message}")
    if errors:
        print(f"AI 컨텍스트 규칙 위반 {len(errors)}건. 규칙: ADR 0013", file=sys.stderr)
        return 1
    print("AI 컨텍스트 검사 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
