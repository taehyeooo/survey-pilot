-- 응답 제출을 한 트랜잭션으로(R-16, R-19). 설문 행을 잠그고(for update) 세므로 목표보다 많이 받지 않는다.
-- 답 검사(필수·선택지·척도)는 서버 코드가 먼저 한다(src/lib/submit.ts). 이 함수는 서버(service role)만 부른다.
-- 돌려주는 값: ok | closed(마감·보관·목표 도달·마감일 지남) | done(이미 응답함)
create function submit_response(p_survey_id uuid, p_respondent_id uuid, p_ip_hash text, p_answers jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  s surveys%rowtype;
  n int;
  rid uuid;
begin
  select * into s from surveys where id = p_survey_id for update;
  if not found or s.status <> 'published' or s.archived_at is not null then
    return 'closed';
  end if;
  if s.closes_at is not null and s.closes_at <= now() then
    update surveys set status = 'closed', closed_at = now(), close_reason = 'deadline' where id = s.id;
    return 'closed';
  end if;
  if exists (select 1 from responses where respondent_id = p_respondent_id) then
    return 'done';
  end if;
  select count(*) into n from responses where survey_id = s.id;
  if s.target_responses is not null and n >= s.target_responses then
    return 'closed';
  end if;
  insert into responses (survey_id, respondent_id, ip_hash) values (s.id, p_respondent_id, p_ip_hash) returning id into rid;
  insert into answers (response_id, question_id, value)
    select rid, (a ->> 'question_id')::uuid, a -> 'value' from jsonb_array_elements(p_answers) a;
  if s.target_responses is not null and n + 1 >= s.target_responses then
    update surveys set status = 'closed', closed_at = now(), close_reason = 'target' where id = s.id;
  end if;
  return 'ok';
end $$;

revoke all on function submit_response(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function submit_response(uuid, uuid, text, jsonb) to service_role;
