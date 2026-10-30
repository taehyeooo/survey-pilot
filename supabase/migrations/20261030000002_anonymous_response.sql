-- 설문마다 응답 방식(사용자 결정 2026-10-30, ADR 0017 v2): 기본은 이메일 없이 바로 응답,
-- 주인이 "한 사람 한 번만"을 켜면 지금처럼 이메일 인증.
alter table surveys add column require_email boolean not null default false;

-- 응답자를 무엇으로 구별했나. email: email_hash = HMAC(이메일), browser: email_hash = HMAC(브라우저 표시).
-- 같은 칸과 unique (survey_id, email_hash)를 그대로 써서 1인(1브라우저) 1응답을 DB가 막는다.
alter table respondents add column via text not null default 'email' check (via in ('email', 'browser'));
