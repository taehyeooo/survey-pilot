#!/bin/sh
# check-commit-msg.sh 테스트. 사용: scripts/test-check-commit-msg.sh
# 규칙을 바꾸면 여기에 사례를 먼저 추가한다.

set -u

dir=$(cd "$(dirname "$0")" && pwd)
check="$dir/check-commit-msg.sh"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

pass=0
failed=0

# expect <ok|ng> <설명> <메시지>
expect() {
  printf '%s' "$3" > "$tmp"
  if sh "$check" "$tmp" 2>/dev/null; then got=ok; else got=ng; fi
  if [ "$got" = "$1" ]; then
    pass=$((pass + 1))
  else
    failed=$((failed + 1))
    echo "실패: $2 (기대 $1, 결과 $got)"
  fi
}

nl='
'

# 통과해야 하는 것
expect ok "기본 형식" "docs: 규칙 추가"
expect ok "타입 8종 - feat" "feat: 지도 API 연동"
expect ok "타입 8종 - fix" "fix: 로그인 오류 수정"
expect ok "타입 8종 - style" "style: 들여쓰기 정리"
expect ok "타입 8종 - refactor" "refactor: 서비스 분리"
expect ok "타입 8종 - chore" "chore: 줄바꿈 LF로 고정"
expect ok "타입 8종 - perf" "perf: 쿼리 개선"
expect ok "타입 8종 - test" "test: 커밋 검사 사례 추가"
expect ok "squash 제목의 PR 번호" "docs: 모노레포 초기 구조와 기준 문서 (#2)"
expect ok "끝 줄바꿈" "docs: 규칙 추가$nl"
expect ok "git 주석 줄은 무시" "docs: 규칙 추가$nl# Please enter the commit message$nl# 주석"
expect ok "가운뎃점·화살표는 이모지 아님" "docs: 공통 모듈·MCP → 안내"

# 거부해야 하는 것
expect ng "빈 메시지" ""
expect ng "타입 없음" "규칙 추가"
expect ng "없는 타입" "update: 규칙 추가"
expect ng "대문자 타입" "Docs: 규칙 추가"
expect ng "콜론 뒤 공백 없음" "docs:규칙 추가"
expect ng "내용 없음" "docs: "
expect ng "괄호 스코프" "docs(kb): 규칙 추가"
expect ng "본문" "docs: 규칙 추가${nl}${nl}자세한 설명"
expect ng "Co-Authored-By 트레일러" "docs: 규칙 추가${nl}${nl}Co-Authored-By: Claude <noreply@anthropic.com>"
expect ng "첫 줄의 서명" "docs: 규칙 추가 Generated with Claude Code"
expect ng "소문자 co-authored-by" "docs: 규칙 추가 co-authored-by"
expect ng "로봇 이모지" "docs: 규칙 추가 🤖"
expect ng "체크 이모지" "fix: 버그 수정 ✅"
expect ng "머지 커밋 기본 메시지" "Merge branch 'main' into feat/#12-map"
expect ng "되돌리기 기본 메시지" "Revert \"docs: 규칙 추가\""

echo "통과 $pass, 실패 $failed"
[ "$failed" -eq 0 ]
