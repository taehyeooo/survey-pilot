-- 서베이 파일럿 스키마. 규칙 근거: docs/specs/2026-10-29-survey-pilot.md, ADR 0017·0019.
-- 응답자 쪽은 DB에 직접 접근하지 않는다 — anon 권한·정책 없음. 쓰기는 서버(service role)가 한다.

create type survey_status as enum ('designing', 'reviewing', 'published', 'closed');
create type close_reason as enum ('target', 'deadline', 'manual', 'archive');
create type question_type as enum ('single', 'multi', 'scale', 'text');
create type report_kind as enum ('interim', 'final');
create type usage_kind as enum ('ai', 'mail');
create type usage_status as enum ('ok', 'error', 'blocked');

-- 관리자 이메일(R-1). 서버가 ADMIN_EMAIL로 채운다. 정책 없음 — 서버만.
create table admins (
  email text primary key check (email = lower(email))
);

create table surveys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  status survey_status not null default 'designing',
  archived_at timestamptz,
  problem text not null check (char_length(problem) between 10 and 1000),
  clarifications jsonb not null default '[]',
  purpose text,
  audience text,
  target_responses int check (target_responses > 0), -- 권장 응답 수 = 목표 응답 수(R-8, R-16, R-24)
  target_minutes int check (target_minutes > 0),
  closes_at timestamptz,
  intro text,
  share_message text,
  slug text unique,
  closed_at timestamptz,
  close_reason close_reason,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('published', 'closed')) = (slug is not null)),
  check ((status = 'closed') = (closed_at is not null and close_reason is not null))
);

create table hypotheses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  position int not null,
  statement text not null,
  unique (survey_id, position)
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  hypothesis_id uuid references hypotheses (id) on delete set null,
  position int not null,
  type question_type not null,
  prompt text not null,
  options jsonb not null default '[]', -- [{id, label}]
  required boolean not null default true,
  review_note text,
  unique (survey_id, position) deferrable initially immediate, -- 순서 바꾸기는 한 트랜잭션에서
  check (jsonb_typeof(options) = 'array'),
  check ((type in ('single', 'multi')) = (jsonb_array_length(options) >= 2))
);

create table verifications (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  email_hash text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  consumed_at timestamptz,
  ip_hash text
);
create index verifications_lookup on verifications (survey_id, email_hash, sent_at desc);
create index verifications_ip on verifications (ip_hash, sent_at desc);

create table respondents (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  email_hash text not null,
  email text, -- 마감 30일 후 null(R-30, ADR 0017)
  consented_at timestamptz not null,
  verified_at timestamptz not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (survey_id, email_hash), -- 1인 1응답(R-19)
  unique (id, survey_id)
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  respondent_id uuid not null unique,
  submitted_at timestamptz not null default now(),
  ip_hash text,
  foreign key (respondent_id, survey_id) references respondents (id, survey_id) on delete cascade
);
create index responses_survey on responses (survey_id);
create index responses_ip on responses (ip_hash, submitted_at desc);

create table answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  value jsonb not null, -- 선택지 id 배열 / 1~5 / 텍스트. 검사는 서버(R-19)
  unique (response_id, question_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  kind report_kind not null,
  response_count int not null,
  content jsonb not null,
  is_tentative boolean not null,
  created_at timestamptz not null default now(),
  unique (survey_id, kind, response_count) -- 같은 응답 수면 다시 부르지 않는다(R-24)
);

create table usage_events (
  id bigint generated always as identity primary key,
  kind usage_kind not null,
  purpose text not null,
  survey_id uuid references surveys (id) on delete set null,
  status usage_status not null,
  created_at timestamptz not null default now()
);
create index usage_events_window on usage_events (kind, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  survey_id uuid references surveys (id) on delete set null,
  reason text not null check (char_length(reason) > 0),
  detail jsonb not null default '{}', -- 이메일은 해시로만(ADR 0017)
  created_at timestamptz not null default now()
);

-- 상태는 앞으로만, 응답이 생기면 설계 칸 잠금(R-14)
create function surveys_guard() returns trigger language plpgsql as $$
begin
  if new.status < old.status then
    raise exception '설문 상태는 되돌릴 수 없다 (% → %)', old.status, new.status;
  end if;
  if exists (select 1 from responses where survey_id = old.id) and (
    new.problem is distinct from old.problem or
    new.clarifications is distinct from old.clarifications or
    new.purpose is distinct from old.purpose or
    new.audience is distinct from old.audience or
    new.target_minutes is distinct from old.target_minutes or
    new.slug is distinct from old.slug
  ) then
    raise exception '응답이 있는 설문은 소개글·마감일·목표 응답 수만 고칠 수 있다';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger surveys_guard before update on surveys for each row execute function surveys_guard();

-- 응답이 생기면 문항·가설 추가·수정·삭제 금지(R-14). 설문째 지울 때(cascade)는 부모가 이미 없으므로 통과.
create function design_lock() returns trigger language plpgsql as $$
declare
  sid uuid := coalesce(new.survey_id, old.survey_id);
begin
  if exists (select 1 from surveys where id = sid) and exists (select 1 from responses where survey_id = sid) then
    raise exception '응답이 있는 설문의 % 는 바꿀 수 없다', tg_table_name;
  end if;
  return coalesce(new, old);
end $$;
create trigger questions_lock before insert or update or delete on questions for each row execute function design_lock();
create trigger hypotheses_lock before insert or update or delete on hypotheses for each row execute function design_lock();

-- 접근 권한(ADR 0019)
create function is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'))
$$;
revoke all on function is_admin() from anon, public;
grant execute on function is_admin() to authenticated;

alter table admins enable row level security;
alter table surveys enable row level security;
alter table hypotheses enable row level security;
alter table questions enable row level security;
alter table verifications enable row level security;
alter table respondents enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;
alter table reports enable row level security;
alter table usage_events enable row level security;
alter table audit_logs enable row level security;

-- anon은 아무것도 못 한다. 관리자 아닌 로그인 사용자는 정책에서 막힌다.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

create policy surveys_admin_select on surveys for select to authenticated
  using (owner_id = auth.uid() and is_admin());
create policy surveys_admin_insert on surveys for insert to authenticated
  with check (owner_id = auth.uid() and is_admin());
create policy surveys_admin_update on surveys for update to authenticated
  using (owner_id = auth.uid() and is_admin())
  with check (owner_id = auth.uid() and is_admin());
-- delete 정책 없음 — 보관함만(R-5)

create policy hypotheses_admin_select on hypotheses for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()) and is_admin());
create policy questions_admin_select on questions for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()) and is_admin());
create policy respondents_admin_select on respondents for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()) and is_admin());
create policy responses_admin_select on responses for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()) and is_admin());
create policy answers_admin_select on answers for select to authenticated
  using (exists (
    select 1 from responses r join surveys s on s.id = r.survey_id
    where r.id = response_id and s.owner_id = auth.uid()
  ) and is_admin());
create policy reports_admin_select on reports for select to authenticated
  using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()) and is_admin());
-- admins·verifications·usage_events·audit_logs: 정책 없음(서버만)
