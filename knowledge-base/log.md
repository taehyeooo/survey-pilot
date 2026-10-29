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

## 2026-10-29 DB 스키마와 접근 권한 — plan 2단계 (#5, PR #6)
- 한 것: 테이블 11개(+admins)·제약·잠금 트리거·RLS 마이그레이션을 실제 프로젝트(서울)에 적용, DB 통합 테스트 17개. spec v2.
- 확인한 것: 테스트 21개 통과, DB 변형 4/4(anon 읽기·관리자 확인·문항 잠금·설계 잠금) 잡고 복원, 테스트 사용자 잔여 0.
- 확인하지 않은 것: CI에서 DB 테스트(키 없음 — 건너뜀), 동시 수정 경합.
- 남긴 지식: [Supabase 키와 DB 접속](concepts/supabase-api-keys.md) 갱신

## 2026-10-29 무료 한도 가드 — plan 3단계 (#7, PR #8)
- 한 것: `withLimit`(usage_events 1분·24시간 창, blocked 기록), 한도 걸린 AI·메일 래퍼, 스키마 실패 1회 재시도, 한도 환경변수 읽기, Supabase 저장소.
- 확인한 것: 테스트 35개 통과, 변형 6/6 잡음(처음 5/6 — 호출 오류 재시도를 못 잡아 테스트 추가), lint·tsc·build·번들 검사 통과, DB 잔여 0.
- 확인하지 않은 것: 동시 호출 때 1건 초과 가능(세기와 부르기가 원자적이지 않음), 실제 Gemini·Gmail 호출. CI 첫 실행 실패(키 없을 때 DB 테스트 수집 오류) 고침.
- 남긴 지식: [Vitest @ 별칭](troubleshooting/2026-10-29-vitest-at-alias.md)

## 2026-10-29 관리자 로그인과 설문 목록 — plan 5단계 (#9, PR #10)
- 한 것: 매직링크 로그인(ADMIN_EMAIL만, admins 테이블 맞춤), proxy 세션 갱신, 콜백, 목록 탭 4개·응답 수, 보관·복원, 로그아웃. Spring AI는 쓰지 않기로(사용자).
- 확인한 것: 테스트 43개·변형 3/3 통과, build·lint·tsc·번들 검사, 브라우저에서 미로그인 리다이렉트·비관리자 거절·만료 안내·오류 뒤 입력 유지.
- 확인하지 않은 것: 실제 관리자 매직링크 로그인(메일 클릭은 사용자), 로그인 뒤 목록 화면 실물.
- 남긴 지식: 없음
