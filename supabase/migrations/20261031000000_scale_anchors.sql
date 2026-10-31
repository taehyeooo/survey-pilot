-- 척도 문항의 양 끝 말(결정 41) — scale은 options에 [{id,label}] 2개(1점 쪽·5점 쪽)를 둘 수 있다.
-- 이전 규칙: single·multi만 선택지 2개 이상, 나머지는 0개. 이제 scale은 0개 또는 2개, text는 0개.
alter table questions drop constraint questions_check;
alter table questions add constraint questions_options_by_type check (
  case type
    when 'single' then jsonb_array_length(options) >= 2
    when 'multi' then jsonb_array_length(options) >= 2
    when 'scale' then jsonb_array_length(options) in (0, 2)
    else jsonb_array_length(options) = 0
  end
);
