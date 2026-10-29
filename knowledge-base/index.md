# 지식베이스 목차

AI와 새로 온 사람이 **묻지 않고 일할 수 있게** 하는 것이 목표다.
지식베이스 문서는 이 목차나 자기 폴더 README 목록에 한 줄로 걸려 있어야 한다 — 빠지면 `check_docs.py`가 실패시킨다(ADR 0009).

## 어디에 무엇을 쓰나

| 위치 | 담는 것 | 언제 쓰나 |
|---|---|---|
| [decisions/](decisions/README.md) | 결정과 이유, 비교한 대안, 다시 볼 조건 (ADR) | 방향·정책·구조를 정할 때 |
| [now.md](now.md) | 지금 상태: 진행 중인 일, 다음 할 일, 답이 필요한 것 (고쳐 씀, 인계 메모) | 작업이 끝날 때, 순서가 바뀔 때 |
| [log.md](log.md) | 작업 하나에서 무엇을 했고 무엇을 확인했나 (append-only) | 작업(PR)이 끝날 때 |
| [troubleshooting/](troubleshooting/README.md) | 문제의 근본 원인과 해결 (3단계) | 원인을 찾았을 때 |
| [runbooks/](runbooks/README.md) | 알림이 울렸을 때 먼저 볼 것과 조치 | 알림을 만들 때 |
| [concepts/](concepts/README.md) | 도메인·기술 개념 설명 | 개념을 새로 이해했을 때 |
| `docs/specs`, `docs/plans` | 기능 설계와 구현 순서 | 만들기 전 |
| `CLAUDE.md` | 지켜야 할 규칙 요약 + 위 문서 링크 | 규칙이 바뀔 때 |

## 결정 (ADR)

[decisions/README.md](decisions/README.md)에 전체 목록이 있다.

## 개념

- [Supabase API 키](concepts/supabase-api-keys.md) — 공개 키(anon/publishable)와 비밀 키(service_role/secret), 이 레포 변수와 쓰는 곳

## 외부 자료
