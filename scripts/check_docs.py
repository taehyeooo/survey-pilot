#!/usr/bin/env python3
"""문서 규칙 검사 (ADR 0004, ADR 0009, ADR 0014)

사용: python3 scripts/check_docs.py [레포 루트]   (기본: 현재 폴더)

검사
  1. frontmatter — 문서 종류마다 필수 항목이 있고 값이 올바른가
     (version은 양의 정수, status는 active|superseded, ADR id는 파일 번호와 같음,
      superseded ADR은 superseded_by가 실제 ADR을 가리킴)
  2. plan의 based_on — `<경로> v<번호>` 형식, 기준 문서가 있고 superseded가 아니며 버전이 같음
     (기준 문서 버전이 올라가면 plan을 다시 검토하라는 뜻으로 실패시킨다. superseded plan은 검사하지 않음)
  3. 깨진 상대 링크 — 마크다운 링크와 frontmatter의 sources·used_by·related 경로가 실제 파일을 가리키는가
  5. 요구사항 ID 추적(ADR 0014, 옵트인) — spec에 `- **R-1** ...` 정의가 있으면 ID 중복이 없고,
     ID마다 based_on이 그 spec인 active plan의 체크 단계 줄이 인용하며, plan이 인용한 ID가 spec에 있는가.
     ID가 있는 spec에 active plan이 아직 없으면 경고만(종료 코드 그대로)
  5-1. 요구사항 → 테스트 연결(ADR 0014) — 테스트 소스(TEST_DIRS·TEST_FILES)의 `<slug>#R-n` 인용을 읽어
     ID가 있는 spec마다 요구사항 수·테스트 있는 수·비율·빠진 ID를 출력한다. slug는 spec 파일 이름에서 날짜·확장자를 뺀 것.
     없는 spec·없는 ID·ID 없는 spec 인용과 slug 중복은 실패, 테스트가 없는 요구사항은 경고만
  6. 목차 빠짐(ADR 0009) — knowledge-base/index.md가 있으면, knowledge-base 안 문서(.md·.yaml, README·index 제외)는
     index.md 또는 자기 폴더 README.md에서 링크되어야 한다(Karpathy lint "고아 페이지")
  7. ADR 확인 방법(ADR 0001) — CONFIRMATION_FROM 번호부터의 ADR은 `## 확인 방법` 칸에 내용이 있어야 한다
  8. 대응 문서 단계 표시(ADR 0001) — runbooks의 단계 칸(먼저 볼 것·조치·끝나면·켜기·끄기) 목록 줄은
     `[자동]` 또는 `[사람 확인]`으로 시작한다

외부 패키지 없이 표준 라이브러리만 쓴다.
"""

import os
import re
import sys
from fnmatch import fnmatch
from urllib.parse import unquote

VERSIONED_STATUS = {"active", "superseded"}
TROUBLESHOOTING_STATUS = {"resolved", "workaround", "open"}
PATH_LIST_KEYS = ("sources", "used_by", "related")
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__", "_code-map", ".obsidian"}

# (파일 패턴, 필수 항목, status 허용값) — README.md와 템플릿은 검사하지 않는다
RULES = [
    ("docs/charter.md", ("title", "version", "status"), VERSIONED_STATUS),
    ("docs/specs/*.md", ("title", "version", "status"), VERSIONED_STATUS),
    ("docs/plans/*.md", ("title", "version", "status", "based_on"), VERSIONED_STATUS),
    ("knowledge-base/decisions/[0-9][0-9][0-9][0-9]-*.md",
     ("id", "title", "version", "status", "date", "sources"), VERSIONED_STATUS),
    ("knowledge-base/concepts/*.md", ("title", "version", "status"), VERSIONED_STATUS),
    ("knowledge-base/troubleshooting/*.md", ("title", "date", "status"), TROUBLESHOOTING_STATUS),
    ("knowledge-base/runbooks/*.md", ("title", "version", "status", "alert"), VERSIONED_STATUS),
    ("services/*/docs/specs/*.md", ("title", "version", "status"), VERSIONED_STATUS),
    ("services/*/docs/plans/*.md", ("title", "version", "status", "based_on"), VERSIONED_STATUS),
]
EXCLUDE = ("*/README.md", "README.md", "docs/templates/*")

LINK_RE = re.compile(r"\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
INLINE_CODE_RE = re.compile(r"`[^`]*`")
BASED_ON_RE = re.compile(r"^(\S+)\s+v(\d+)$")


class Doc:
    def __init__(self, root, rel):
        self.root = root
        self.rel = rel
        self.path = os.path.join(root, rel)
        with open(self.path, encoding="utf-8") as f:
            self.lines = f.read().splitlines()
        self.meta, self.meta_lines = parse_meta(self.lines, rel.endswith((".yaml", ".yml")))


def strip_comment(value):
    # `값   # 설명` 에서 설명을 뗀다 (따옴표 안의 #은 쓰지 않는다고 가정)
    return re.split(r"\s+#", value, maxsplit=1)[0].strip()


def unquote_value(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_meta(lines, is_yaml):
    """frontmatter(마크다운) 또는 최상위 키(YAML)를 {키: 값 또는 [목록]}으로 읽는다."""
    if is_yaml:
        body = list(enumerate(lines, 1))
    else:
        if not lines or lines[0].strip() != "---":
            return {}, {}
        end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
        if end is None:
            return {}, {}
        body = [(i + 1, lines[i]) for i in range(1, end)]

    meta, meta_lines, key = {}, {}, None
    for no, line in body:
        top = re.match(r"^([A-Za-z_][\w-]*):(.*)$", line)
        if top:
            key = top.group(1)
            value = unquote_value(strip_comment(top.group(2)))
            meta[key] = value if value else []
            meta_lines[key] = no
            continue
        item = re.match(r"^\s+-\s+(.*)$", line)
        if item and key is not None and isinstance(meta.get(key), list):
            value = unquote_value(strip_comment(item.group(1)))
            if value:
                meta[key].append((no, value))
            continue
        if line.strip() and not line.startswith((" ", "\t", "#")):
            key = None
    return meta, meta_lines


def is_empty(value):
    return value == "" or value == []


def walk_files(root):
    for base, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(files):
            yield os.path.relpath(os.path.join(base, name), root).replace(os.sep, "/")


def rule_for(rel):
    if any(fnmatch(rel, pattern) for pattern in EXCLUDE):
        return None
    for pattern, required, statuses in RULES:
        if fnmatch(rel, pattern):
            return required, statuses
    return None


def check_frontmatter(doc, required, statuses, errors):
    line_of = lambda key: doc.meta_lines.get(key, 1)
    if not doc.meta:
        errors.append((doc.rel, 1, "frontmatter가 없다"))
        return
    for key in required:
        if key not in doc.meta or is_empty(doc.meta[key]):
            errors.append((doc.rel, 1, f"frontmatter에 `{key}`가 없다"))

    version = doc.meta.get("version")
    if isinstance(version, str) and version and not re.fullmatch(r"[1-9]\d*", version):
        errors.append((doc.rel, line_of("version"), f"version은 양의 정수여야 한다 → `{version}`"))

    status = doc.meta.get("status")
    if isinstance(status, str) and status and status not in statuses:
        allowed = " | ".join(sorted(statuses))
        errors.append((doc.rel, line_of("status"), f"status는 {allowed} 중 하나여야 한다 → `{status}`"))

    if doc.rel.startswith("knowledge-base/decisions/"):
        check_adr(doc, errors)
    if doc.rel.startswith("knowledge-base/runbooks/"):
        check_runbook_steps(doc, errors)


# 이 번호부터의 ADR은 `## 확인 방법`(MADR Confirmation)이 있어야 한다 — 그 전 ADR은 고쳐 쓸 때 채운다(ADR 0001)
CONFIRMATION_FROM = 1
CONFIRMATION_HEADING = "확인 방법"


def check_adr(doc, errors):
    number = os.path.basename(doc.rel)[:4]
    if number.isdigit() and int(number) >= CONFIRMATION_FROM and not section_has_text(doc, CONFIRMATION_HEADING):
        errors.append((doc.rel, 1, f"`## {CONFIRMATION_HEADING}` 칸이 없거나 비었다 — 이 결정을 지키는 테스트·훅·CI, 없으면 \"사람 리뷰\"(ADR 0001)"))
    adr_id = doc.meta.get("id")
    if isinstance(adr_id, str) and adr_id and adr_id != number:
        errors.append((doc.rel, doc.meta_lines.get("id", 1), f"id `{adr_id}`가 파일 번호 `{number}`와 다르다"))
    if doc.meta.get("status") == "superseded":
        target = doc.meta.get("superseded_by")
        if not isinstance(target, str) or not target:
            errors.append((doc.rel, doc.meta_lines.get("status", 1), "superseded ADR에 `superseded_by`가 없다"))
            return
        target = target.zfill(4)
        folder = os.path.dirname(doc.path)
        if not any(name.startswith(target + "-") for name in os.listdir(folder)):
            errors.append((doc.rel, doc.meta_lines.get("superseded_by", 1),
                           f"superseded_by `{target}` ADR 파일이 없다"))


def section_has_text(doc, heading):
    """`## <heading>` 칸에 주석·빈 줄이 아닌 내용이 있는가."""
    inside, text = False, ""
    for _no, line in body_lines(doc):
        if re.match(r"^#{1,2}\s", line):
            if inside:
                break
            inside = re.match(r"^##\s+" + re.escape(heading) + r"\s*$", line) is not None
            continue
        if inside:
            text += line
    return re.sub(r"<!--.*?-->", "", text, flags=re.S).strip() != ""


# 대응 문서의 단계 칸 — 이 칸의 목록 줄(들여 쓰지 않은 것)은 단계 표시로 시작한다
RUNBOOK_STEP_SECTIONS = ("먼저 볼 것", "조치", "끝나면", "켜기", "끄기")
RUNBOOK_MARKERS = ("[자동]", "[사람 확인]")
LIST_ITEM_RE = re.compile(r"^(?:[-*+]|\d+\.)\s+(.*)$")


def check_runbook_steps(doc, errors):
    in_steps = False
    for no, line in body_lines(doc):
        heading = re.match(r"^##\s+(.+?)\s*$", line)
        if heading:
            in_steps = heading.group(1).startswith(RUNBOOK_STEP_SECTIONS)
            continue
        item = LIST_ITEM_RE.match(line)
        if in_steps and item and not item.group(1).startswith(RUNBOOK_MARKERS):
            errors.append((doc.rel, no, "대응 문서 단계는 `[자동]` 또는 `[사람 확인]`으로 시작한다(runbooks/README \"쓰는 법\")"))


def resolve_doc_path(doc, target):
    """레포 루트 기준 또는 문서 폴더 기준 경로를 레포 상대 경로로. 없으면 None."""
    candidates = [os.path.normpath(target), os.path.normpath(os.path.join(os.path.dirname(doc.rel), target))]
    return next((c.replace(os.sep, "/") for c in candidates
                 if os.path.isfile(os.path.join(doc.root, c))), None)


def check_based_on(doc, docs_by_rel, errors):
    if doc.meta.get("status") == "superseded":
        return
    value = doc.meta.get("based_on")
    if not isinstance(value, str) or not value:
        return  # 누락은 check_frontmatter가 잡는다
    line = doc.meta_lines.get("based_on", 1)
    match = BASED_ON_RE.match(value)
    if not match:
        errors.append((doc.rel, line, f"based_on은 `<경로> v<번호>` 형식이어야 한다 → `{value}`"))
        return
    target, version = match.group(1), match.group(2)
    rel = resolve_doc_path(doc, target)
    if rel is None:
        errors.append((doc.rel, line, f"based_on 기준 문서가 없다 → `{target}`"))
        return
    base = docs_by_rel.get(rel) or Doc(doc.root, rel)
    if base.meta.get("status") == "superseded":
        errors.append((doc.rel, line, f"based_on 기준 문서가 superseded 상태다 → `{rel}` (새 기준으로 plan을 다시 검토)"))
    base_version = base.meta.get("version")
    if isinstance(base_version, str) and base_version and base_version != version:
        errors.append((doc.rel, line,
                       f"based_on은 v{version}인데 기준 문서는 v{base_version}이다 → `{rel}` (plan을 다시 검토하고 based_on을 올린다)"))


def check_links(root, rel, errors):
    path = os.path.join(root, rel)
    folder = os.path.dirname(path)
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    in_fence = False
    for no, line in enumerate(lines, 1):
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK_RE.findall(INLINE_CODE_RE.sub("", line)):
            check_target(root, rel, folder, no, target, errors)

    meta, _ = parse_meta(lines, False)
    for key in PATH_LIST_KEYS:
        values = meta.get(key)
        if isinstance(values, list):
            for no, value in values:
                if re.search(r"\.(md|ya?ml)(#.*)?$", value) and not re.match(r"^[a-z]+:", value):
                    check_target(root, rel, folder, no, value, errors)


def check_target(root, rel, folder, no, target, errors):
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
        return  # http:, mailto: 등 외부 링크와 같은 문서 안 앵커
    file_part = unquote(target.split("#", 1)[0])
    if not file_part:
        return
    resolved = os.path.normpath(os.path.join(folder, file_part))
    if not os.path.exists(resolved):
        errors.append((rel, no, f"깨진 링크 → `{target}`"))


REQ_ID = r"(?<![\w-])R-([1-9]\d*)(?![\w-])"
REQ_ID_RE = re.compile(REQ_ID)
# spec 요구사항 정의 줄: `- **R-1** ...` 또는 `1. **R-1** ...`
REQ_DEF_RE = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+\*\*" + REQ_ID + r"\*\*")
# plan 체크 단계 줄: `1. [ ] ...`, `3-1. [x] ...`, `- [~] ...`
TASK_RE = re.compile(r"^\s*(?:[-*+]|\d+(?:-\d+)?\.)\s+\[[ xX~]\]")


def body_lines(doc):
    """frontmatter·코드 블록을 빼고 인라인 코드를 지운 본문 줄을 (줄 번호, 내용)으로."""
    lines, start = doc.lines, 0
    if lines and lines[0].strip() == "---":
        end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
        if end is not None:
            start = end + 1
    in_fence = False
    for i in range(start, len(lines)):
        if re.match(r"^\s*(```|~~~)", lines[i]):
            in_fence = not in_fence
            continue
        if not in_fence:
            yield i + 1, INLINE_CODE_RE.sub("", lines[i])


def plan_spec(doc):
    """plan의 based_on이 가리키는 문서(레포 상대 경로). 형식이 틀리거나 없으면 None."""
    value = doc.meta.get("based_on")
    match = BASED_ON_RE.match(value) if isinstance(value, str) else None
    return resolve_doc_path(doc, match.group(1)) if match else None


def check_requirement_trace(docs_by_rel, errors, warnings):
    """요구사항 ID 추적(ADR 0014): spec의 `**R-n**` 정의마다 active plan 체크 단계의 인용이 있는가. ID가 있는 spec만 본다."""
    defs = {}  # spec → {번호: 정의 줄}
    for doc in docs_by_rel.values():
        if "/specs/" not in doc.rel or doc.meta.get("status") == "superseded":
            continue
        found = {}
        for no, line in body_lines(doc):
            m = REQ_DEF_RE.match(line)
            if not m:
                continue
            if m.group(1) in found:
                errors.append((doc.rel, no, f"요구사항 ID `R-{m.group(1)}`가 중복 정의됐다(처음: {found[m.group(1)]}줄)"))
            else:
                found[m.group(1)] = no
        if found:
            defs[doc.rel] = found

    cited = {}  # spec → 인용된 번호 (active plan이 있는 spec만 키가 생긴다)
    for doc in docs_by_rel.values():
        if "/plans/" not in doc.rel or doc.meta.get("status") == "superseded":
            continue
        spec = plan_spec(doc)
        spec_ids = defs.get(spec, {})
        if spec in defs:
            cited.setdefault(spec, set())
        for no, line in body_lines(doc):
            ids = REQ_ID_RE.findall(line)
            for n in ids:
                if n not in spec_ids:
                    errors.append((doc.rel, no, f"기준 spec에 없는 요구사항 ID `R-{n}`를 인용했다 → `{spec or 'based_on 확인'}`"))
            if spec in defs and TASK_RE.match(line):
                cited[spec].update(ids)

    for rel, found in defs.items():
        if rel not in cited:
            warnings.append((rel, min(found.values()), "요구사항 ID가 있지만 based_on이 이 spec인 active plan이 아직 없다"))
            continue
        for n, no in found.items():
            if n not in cited[rel]:
                errors.append((rel, no, f"요구사항 `R-{n}`가 plan 체크 단계에서 인용되지 않았다"
                                        f" — based_on이 이 spec인 active plan의 단계 줄에 `(R-{n})`를 적는다"))
    return defs


# 테스트 소스: 이 폴더 안이거나(test/, tests/, __tests__/, test-qa/ 같은 test-*), 파일 이름이 테스트 모양
TEST_EXTS = (".java", ".kt", ".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".sh")
TEST_DIRS = ("test", "tests", "__tests__")
TEST_FILES = ("*.test.*", "*.spec.*", "test_*.py", "*_test.py", "test-*.sh")
BUILD_DIRS = {"build", "dist", "out", "target", "coverage", ".next", ".gradle", ".expo"}
# `<slug>#R-<번호>` — 앞이 글자·경로 조각이 아니고, 뒤가 숫자·글자가 아닐 때만(`specs/a#R-1`, `a#R-12`의 R-1은 아님)
TEST_REF_RE = re.compile(r"(?<![\w/.-])([a-z0-9][a-z0-9-]*)#R-([1-9]\d*)(?![\w-])")


def spec_slug(rel):
    """spec 파일 이름에서 앞 날짜(YYYY-MM-DD-)와 .md를 뺀 이름 — 테스트가 `<slug>#R-1`로 인용한다."""
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", os.path.basename(rel)[:-3])


def is_test_source(rel):
    parts = rel.split("/")
    if not rel.endswith(TEST_EXTS) or BUILD_DIRS.intersection(parts[:-1]):
        return False
    in_test_dir = any(p in TEST_DIRS or p.startswith("test-") for p in parts[:-1])
    return in_test_dir or any(fnmatch(parts[-1], pattern) for pattern in TEST_FILES)


def check_test_trace(root, files, defs, errors, warnings, report):
    """요구사항 → 테스트 연결(ADR 0014): 테스트 소스의 `<slug>#R-n`을 세어 spec마다 보고한다."""
    by_slug = {}
    for rel in sorted(defs):
        slug = spec_slug(rel)
        if slug in by_slug:
            errors.append((rel, 1, f"요구사항 ID를 쓰는 spec끼리 slug `{slug}`가 같다(`{by_slug[slug]}`) — 테스트 인용이 모호하니 파일 이름을 바꾼다"))
        else:
            by_slug[slug] = rel
    tested = {rel: set() for rel in defs}
    for rel in files:
        if not is_test_source(rel):
            continue
        with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as f:
            lines = f.read().splitlines()
        for no, line in enumerate(lines, 1):
            for slug, n in TEST_REF_RE.findall(line):
                spec = by_slug.get(slug)
                if spec is None:
                    errors.append((rel, no, f"테스트가 인용한 spec `{slug}`가 없다(요구사항 ID가 있는 active spec 파일 이름에서 날짜를 뺀 것) → `{slug}#R-{n}`"))
                elif n not in defs[spec]:
                    errors.append((rel, no, f"테스트가 인용한 `R-{n}`가 spec `{spec}`에 없다 → `{slug}#R-{n}`"))
                else:
                    tested[spec].add(n)
    for rel in sorted(defs):
        found = defs[rel]
        ids = sorted(found, key=int)
        missing = [f"R-{n}" for n in ids if n not in tested[rel]]
        report.append({"spec": rel, "slug": spec_slug(rel), "total": len(ids),
                       "tested": len(ids) - len(missing), "missing": missing})
        if missing:
            first = min(found[n[2:]] for n in missing)
            warnings.append((rel, first, f"테스트가 인용하지 않은 요구사항: {', '.join(missing)}"
                                         f" — 확인하는 테스트에 `{spec_slug(rel)}#R-번호`를 적는다(주석·테스트 이름)"))


KB = "knowledge-base"
KB_INDEX = KB + "/index.md"


def linked_targets(root, rel):
    """문서의 마크다운 링크가 가리키는 파일(레포 상대 경로) 집합. 코드 블록·인라인 코드 안은 뺀다."""
    path = os.path.join(root, rel)
    if not os.path.isfile(path):
        return set()
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    found, in_fence = set(), False
    for line in lines:
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for target in LINK_RE.findall(INLINE_CODE_RE.sub("", line)):
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            file_part = unquote(target.split("#", 1)[0])
            if file_part:
                found.add(os.path.normpath(os.path.join(os.path.dirname(rel), file_part)).replace(os.sep, "/"))
    return found


def check_orphans(root, files, errors):
    """목차 빠짐(ADR 0009): knowledge-base 문서는 index.md 또는 자기 폴더 README.md에서 링크되어야 한다."""
    if KB_INDEX not in files:
        return
    from_index = linked_targets(root, KB_INDEX)
    readme_links = {}
    for rel in files:
        if not rel.startswith(KB + "/") or not rel.endswith((".md", ".yaml")):
            continue
        if rel == KB_INDEX or os.path.basename(rel) == "README.md":
            continue
        folder = os.path.dirname(rel)
        if folder not in readme_links:
            readme_links[folder] = linked_targets(root, folder + "/README.md")
        if rel not in from_index and rel not in readme_links[folder]:
            where = f"`{folder}/README.md` 목록이나 " if os.path.isfile(os.path.join(root, folder, "README.md")) else ""
            errors.append((rel, 1, f"목차에 없는 문서다 — {where}`{KB_INDEX}`에 한 줄 요약과 링크를 더한다"))


def check(root, warnings=None, report=None):
    """규칙 위반 [(파일, 줄, 메시지)]을 돌려준다. warnings 목록을 넘기면 실패가 아닌 경고를,
    report 목록을 넘기면 spec마다 요구사항 → 테스트 연결 결과(dict)를 거기에 더한다."""
    if warnings is None:
        warnings = []
    if report is None:
        report = []
    errors = []
    docs_by_rel = {}
    files = list(walk_files(root))
    for rel in files:
        rule = rule_for(rel)
        if rule:
            doc = Doc(root, rel)
            docs_by_rel[rel] = doc
            check_frontmatter(doc, rule[0], rule[1], errors)
    for doc in docs_by_rel.values():
        if "based_on" in doc.meta or doc.rel.endswith(".md") and "/plans/" in doc.rel:
            check_based_on(doc, docs_by_rel, errors)
    for rel in files:
        # 스크립트 템플릿(scripts/templates/)의 링크는 만들어질 위치(services/<이름>/) 기준이라 여기서는 검사하지 않는다
        if rel.endswith(".md") and not fnmatch(rel, "scripts/templates/*"):
            check_links(root, rel, errors)
    defs = check_requirement_trace(docs_by_rel, errors, warnings)
    check_test_trace(root, files, defs, errors, warnings, report)
    check_orphans(root, files, errors)
    return errors


def main(argv):
    # Windows 콘솔·파이프 기본 인코딩(cp949)에서 한글이 깨지지 않게
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    root = os.path.abspath(argv[1] if len(argv) > 1 else ".")
    warnings, report = [], []
    errors = check(root, warnings, report)
    if report:
        print("요구사항 → 테스트 연결 (ADR 0014, 테스트가 `<slug>#R-번호`를 인용한 것만 셈):")
        for row in report:
            rate = round(100 * row["tested"] / row["total"])
            missing = f" — 테스트 없음: {', '.join(row['missing'])}" if row["missing"] else ""
            print(f"  {row['slug']} ({row['spec']}): 요구사항 {row['total']}개 중 {row['tested']}개 연결 ({rate}%){missing}")
    github = os.environ.get("GITHUB_ACTIONS") == "true"
    for level, items in (("warning", warnings), ("error", errors)):
        for rel, line, message in items:
            if github:
                print(f"::{level} file={rel},line={line}::{message}")
            else:
                print(f"{rel}:{line}: {'경고: ' if level == 'warning' else ''}{message}")
    if errors:
        print(f"문서 규칙 위반 {len(errors)}건. 규칙: ADR 0004, ADR 0009, ADR 0014", file=sys.stderr)
        return 1
    print("문서 규칙 검사 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
