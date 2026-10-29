# 변경 기록 (append-only)

작업이 끝날 때마다 아래에 한 항목씩 **추가만** 한다. 이미 쓴 항목은 고치거나 지우지 않는다(틀렸으면 새 항목으로 정정).

형식:

```
## YYYY-MM-DD <작업 한 줄> (#이슈, PR #번호)
- 한 것:
- 확인한 것:
- 확인하지 않은 것:
- 남긴 지식: (ADR·troubleshooting·concepts 링크, 없으면 "없음")
```

## 2026-10-29 서베이 파일럿 PRD·기능명세서·구현 계획 (#1)
- 한 것: 기획 인터뷰로 PRD(v2)·spec(R-1~R-32)·plan(16단계)·ADR 0017~0019 작성.
- 확인한 것: check_docs 통과, plan이 R-1~R-32를 모두 인용.
- 확인하지 않은 것: Gemini·Gmail·Supabase 메일·Vercel 크론 실제 한도, Gemini 무료 티어 데이터 약관 원문.
- 남긴 지식: [0017](decisions/0017-respondent-privacy.md), [0018](decisions/0018-free-tier-limit-guard.md), [0019](decisions/0019-respondents-via-server-only.md)
