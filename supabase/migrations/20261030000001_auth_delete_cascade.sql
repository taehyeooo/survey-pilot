-- Auth 사용자를 지우면(탈퇴, R-7) profiles → surveys → 문항·가설로 cascade가 이어진다. 이 삭제는 Supabase Auth
-- 역할(supabase_auth_admin)로 실행되는데, 그 역할은 public 테이블을 읽을 권한이 없어 design_lock 트리거 안의
-- select가 "Database error deleting user"로 실패했다. 트리거를 소유자 권한으로 돌린다(검사 내용은 그대로).
create or replace function design_lock() returns trigger language plpgsql security definer set search_path = public as $$
declare
  sid uuid := coalesce(new.survey_id, old.survey_id);
begin
  if exists (select 1 from surveys where id = sid) and exists (select 1 from responses where survey_id = sid) then
    raise exception '응답이 있는 설문의 % 는 바꿀 수 없다', tg_table_name;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function design_lock() from anon, authenticated, public;

-- created_at이 비어 들어오는 Auth 사용자도 프로필을 만든다.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, created_at) values (new.id, lower(coalesce(new.email, '')), coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function handle_new_user() from anon, authenticated, public;
