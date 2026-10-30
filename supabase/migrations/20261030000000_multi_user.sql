-- 여러 사용자(docs/specs/2026-10-30-multi-user.md, ADR 0019 v2·0020).
-- 누구나 가입한다 → 설문은 주인만 읽고, 쓰기는 모두 서버(service role)가 한다.

-- 프로필(R-1·R-2·R-8). Auth 사용자가 생기면 트리거가 만든다 — 가입 경로(링크·관리 API)와 상관없이.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  agreed_at timestamptz, -- 이용 안내 동의(R-2)
  suspended_at timestamptz, -- 운영자 정지(R-8)
  suspend_reason text,
  check ((suspended_at is null) = (suspend_reason is null))
);

create function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, created_at) values (new.id, lower(coalesce(new.email, '')), new.created_at)
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function handle_new_user() from anon, authenticated, public;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- 기존 Auth 사용자 채우기(R-17). 운영자(admins)는 이미 쓰던 사람이라 동의한 것으로.
insert into profiles (id, email, created_at, agreed_at)
select u.id, lower(coalesce(u.email, '')), u.created_at,
       case when exists (select 1 from admins a where a.email = lower(u.email)) then now() end
from auth.users u
on conflict (id) do nothing;

-- 설문 주인 → 프로필, 탈퇴하면 설문과 아래 행이 모두 지워진다(R-7). 운영자가 내린 표시(R-14).
alter table surveys drop constraint surveys_owner_id_fkey;
alter table surveys add constraint surveys_owner_id_fkey foreign key (owner_id) references profiles (id) on delete cascade;
alter table surveys add column taken_down_at timestamptz;
alter table surveys add column takedown_reason text;
alter table surveys add constraint surveys_takedown_pair check ((taken_down_at is null) = (takedown_reason is null));
create index surveys_owner on surveys (owner_id);

-- 사용 기록에 사용자(R-9). 탈퇴해도 한도 집계용으로 남기고 사용자 칸만 비운다.
alter table usage_events add column user_id uuid references profiles (id) on delete set null;
create index usage_events_user on usage_events (user_id, created_at desc);

-- 로그인 링크 요청 횟수(R-1). IP·이메일은 HMAC 해시로만. 서버만.
create table login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index login_attempts_ip on login_attempts (ip_hash, created_at desc);
create index login_attempts_email on login_attempts (email_hash, created_at desc);

alter table profiles enable row level security;
alter table login_attempts enable row level security;
revoke all on profiles, login_attempts from anon;
revoke all on sequence login_attempts_id_seq from anon;

-- RLS(ADR 0019 v2): 주인만 읽는다. ADMIN_EMAIL 조건과 사용자 쓰기 정책은 없앤다 —
-- 쓰기를 열어 두면 공개 키로 상태·내림 표시를 바꿔 서버 검사(동의·정지·한도)를 건너뛸 수 있다.
drop policy surveys_admin_select on surveys;
drop policy surveys_admin_insert on surveys;
drop policy surveys_admin_update on surveys;
drop policy hypotheses_admin_select on hypotheses;
drop policy questions_admin_select on questions;
drop policy respondents_admin_select on respondents;
drop policy responses_admin_select on responses;
drop policy answers_admin_select on answers;
drop policy reports_admin_select on reports;

create policy surveys_owner_select on surveys for select to authenticated using (owner_id = auth.uid());
create policy hypotheses_owner_select on hypotheses for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));
create policy questions_owner_select on questions for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));
create policy respondents_owner_select on respondents for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));
create policy responses_owner_select on responses for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));
create policy answers_owner_select on answers for select to authenticated
  using (exists (
    select 1 from responses r join surveys s on s.id = r.survey_id
    where r.id = response_id and s.owner_id = auth.uid()
  ));
create policy reports_owner_select on reports for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));
create policy profiles_self_select on profiles for select to authenticated using (id = auth.uid());
-- admins·verifications·usage_events·audit_logs·login_attempts: 정책 없음(서버만)
