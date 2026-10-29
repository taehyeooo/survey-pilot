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

## 2026-10-29 서베이 파일럿 PRD·기능명세서·구현 계획 (#1, PR #2)
- 한 것: 기획 인터뷰로 PRD(v2)·spec(R-1~R-32)·plan(16단계)·ADR 0017~0019 작성.
- 확인한 것: check_docs 통과, plan이 R-1~R-32를 모두 인용.
- 확인하지 않은 것: Gemini·Gmail·Supabase 메일·Vercel 크론 실제 한도, Gemini 무료 티어 데이터 약관 원문.
- 남긴 지식: [0017](decisions/0017-respondent-privacy.md), [0018](decisions/0018-free-tier-limit-guard.md), [0019](decisions/0019-respondents-via-server-only.md), [Supabase API 키](concepts/supabase-api-keys.md)

## 2026-10-29 프로젝트 뼈대 — plan 1단계 (#3, PR #4)
- 한 것: Next.js 16·TypeScript·Tailwind, 서버 전용 Supabase 클라이언트, Vitest, AI·메일 경계와 가짜, `.env.example`, 번들 비밀값 검사, web CI, Vercel 지역 icn1.
- 확인한 것: 테스트 4개·변형 4/4(검사기 2, 클라이언트 import 빌드 실패, 비밀값 번들 검출) 통과, 빌드·린트·타입·문서 검사 통과.
- 확인하지 않은 것: Vercel Hobby에서 `regions: icn1` 적용 여부, 배포 런타임 Node 버전, 실제 Supabase 질의.
- 남긴 지식: [vitest ERESOLVE](troubleshooting/2026-10-29-vitest-types-node-eresolve.md)
