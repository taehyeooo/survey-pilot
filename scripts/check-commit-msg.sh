#!/bin/sh
# 커밋 메시지 규칙 검사 (CLAUDE.md "Git 컨벤션", ADR 0008)
# 사용: scripts/check-commit-msg.sh <메시지 파일>
# - 로컬: .githooks/commit-msg 가 호출
# - CI: .github/workflows/rules.yml 이 PR의 커밋·PR 제목마다 호출
#
# 규칙
#   1. 첫 줄은 `타입: 내용` 형식만 (feat/fix/docs/style/refactor/chore/perf/test)
#   2. 첫 줄 외의 텍스트(본문·트레일러) 금지
#   3. AI 서명(Co-Authored-By, Generated with, Claude Code 등)과 이모지 금지

set -eu

file=${1:?메시지 파일 경로가 필요합니다}
types='feat|fix|docs|style|refactor|chore|perf|test'

# git이 넣는 주석 줄(#)과 가위 줄 아래(--verbose diff)는 커밋에 들어가지 않으므로 뺀다.
msg=$(sed -e '/^# -\{24\} >8 -\{24\}$/,$d' -e '/^#/d' "$file")

fail() {
  echo "커밋 메시지 규칙 위반: $1" >&2
  echo "  형식: git commit -m \"타입: 내용\"  (타입: $types)" >&2
  echo "  본문·트레일러·AI 서명·이모지는 붙이지 않는다. 상세: CLAUDE.md \"Git 컨벤션\"" >&2
  exit 1
}

# 앞쪽 빈 줄을 뺀 실제 내용 (뒤쪽 빈 줄은 $(...)가 지운다)
content=$(printf '%s\n' "$msg" | awk 'NF { started = 1 } started')
[ -n "$content" ] || fail "메시지가 비어 있다"

first=$(printf '%s\n' "$content" | head -n 1)
rest=$(printf '%s\n' "$content" | tail -n +2)

# 줄 끝까지 매칭하지 않는다: Windows(MSYS) grep은 `.`이 4바이트 문자(이모지)를 못 받아 엉뚱한 사유로 실패한다.
printf '%s\n' "$first" | grep -Eq "^($types): [^[:space:]]" \
  || fail "첫 줄이 \`타입: 내용\` 형식이 아니다 → \"$first\""

if printf '%s\n' "$rest" | grep -q '[^[:space:]]'; then
  fail "첫 줄 외의 텍스트(본문·트레일러)가 있다"
fi

if printf '%s\n' "$content" | grep -Eiq 'co-authored-by|generated with|claude code|noreply@anthropic'; then
  fail "AI 서명·트레일러가 있다"
fi

# 이모지: 그림 문자·기호 블록과 이모지 변형 선택자
if ! printf '%s\n' "$content" | perl -CSD -ne 'exit 1 if /[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]/'; then
  fail "이모지가 있다"
fi

exit 0
