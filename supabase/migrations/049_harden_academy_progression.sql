-- REBUSCÁNDOME — Academia progression hardening
-- 1) Repair legacy rows where completed_at was persisted without completed=true.
update public.lesson_progress
set completed = true,
    updated_at = now()
where completed_at is not null
  and coalesce(completed,false) = false;

-- 2) Canonical progression validator:
--    - first published lesson of a course is open;
--    - later lessons require the previous lesson in the same module;
--    - first lesson of a module requires every published lesson of the previous module;
--    - answer correctness is verified server-side for every interactive type.
create or replace function public.save_lesson_progress(
  p_lesson_id uuid,
  p_completed boolean default true,
  p_score numeric default null,
  p_last_answer jsonb default '{}'::jsonb,
  p_time_spent_seconds integer default 0
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_role text;
  v_profile_status text;
  v_lesson public.lessons%rowtype;
  v_module public.course_modules%rowtype;
  v_prev_lesson public.lessons%rowtype;
  v_prev_module public.course_modules%rowtype;
  v_answer jsonb := coalesce(p_last_answer,'{}'::jsonb);
  v_type text;
  v_ok boolean := true;
  v_score numeric(5,2) := greatest(0, least(100, coalesce(p_score,100)));
  v_row public.lesson_progress%rowtype;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select role,status into v_profile_role,v_profile_status
  from public.profiles where id=v_user_id limit 1;
  if coalesce(v_profile_role,'')<>'affiliate' or coalesce(v_profile_status,'')<>'active' then
    raise exception 'AFFILIATE_NOT_ACTIVE';
  end if;

  select l.* into v_lesson
  from public.lessons l
  join public.courses c on c.id=l.course_id
  where l.id=p_lesson_id and l.status='published' and c.status='published';
  if not found then raise exception 'LESSON_NOT_AVAILABLE'; end if;
  if coalesce(p_time_spent_seconds,0)<0 then raise exception 'INVALID_TIME_SPENT'; end if;

  if v_lesson.module_id is not null then
    select * into v_module from public.course_modules where id=v_lesson.module_id and status='published';
    if not found then raise exception 'MODULE_NOT_AVAILABLE'; end if;

    select l.* into v_prev_lesson
    from public.lessons l
    where l.module_id=v_lesson.module_id and l.status='published' and l.position < v_lesson.position
    order by l.position desc, l.id desc limit 1;

    if found then
      if not exists (
        select 1 from public.lesson_progress lp
        where lp.user_id=v_user_id and lp.lesson_id=v_prev_lesson.id
          and (coalesce(lp.completed,false) or lp.completed_at is not null)
      ) then
        raise exception 'PREVIOUS_LESSON_REQUIRED';
      end if;
    else
      select * into v_prev_module
      from public.course_modules cm
      where cm.course_id=v_lesson.course_id and cm.status='published'
        and cm.position < v_module.position
      order by cm.position desc, cm.id desc limit 1;

      if found and exists (
        select 1
        from public.lessons pl
        where pl.module_id=v_prev_module.id and pl.status='published'
          and not exists (
            select 1 from public.lesson_progress lp
            where lp.user_id=v_user_id and lp.lesson_id=pl.id
              and (coalesce(lp.completed,false) or lp.completed_at is not null)
          )
      ) then
        raise exception 'PREVIOUS_MODULE_REQUIRED';
      end if;
    end if;
  end if;

  if coalesce(p_completed,true) then
    v_type := coalesce(v_lesson.interactive_data->>'type','');

    if v_type in ('multiple_choice','builder_choice','chat_simulation') then
      v_ok := (v_answer->>'selectedIndex') is not null
        and (v_answer->>'selectedIndex') ~ '^\d+$'
        and (v_answer->>'selectedIndex')::int = coalesce((v_lesson.interactive_data->>'correctIndex')::int,-999);
    elsif v_type='sequence' then
      v_ok := v_answer->'selectedOrder' = v_lesson.interactive_data->'correctOrder';
    elsif v_type='pairing' then
      v_ok := jsonb_typeof(v_answer->'selectedPairs')='array'
        and jsonb_typeof(v_lesson.interactive_data->'pairs')='array'
        and jsonb_array_length(v_answer->'selectedPairs')=jsonb_array_length(v_lesson.interactive_data->'pairs')
        and not exists (
          select 1 from jsonb_array_elements(v_answer->'selectedPairs') with ordinality x(value,idx)
          where x.value is null or x.value::text<>(x.idx-1)::text
        );
    elsif v_type='classification' then
      v_ok := jsonb_typeof(v_answer->'selectedCategories')='array'
        and jsonb_array_length(v_answer->'selectedCategories')=jsonb_array_length(v_lesson.interactive_data->'items')
        and not exists (
          select 1
          from jsonb_array_elements(v_lesson.interactive_data->'items') with ordinality i(item,idx)
          where coalesce(v_answer->'selectedCategories'->>(i.idx-1),'')<>coalesce(i.item->>'answer','')
        );
    elsif v_type='checklist' then
      v_ok := jsonb_typeof(v_answer->'checkedItems')='array'
        and jsonb_array_length(v_answer->'checkedItems')=jsonb_array_length(v_lesson.interactive_data->'items')
        and not exists (
          select 1 from jsonb_array_elements_text(v_answer->'checkedItems') x where x <> 'true'
        );
    elsif v_type in ('builder','planner') then
      v_ok := jsonb_typeof(v_answer->'fields')='array'
        and jsonb_array_length(v_answer->'fields')=coalesce(jsonb_array_length(v_lesson.interactive_data->'fields'),1)
        and not exists (
          select 1 from jsonb_array_elements_text(v_answer->'fields') x where length(trim(x)) < 3
        );
    elsif v_type='final_builder' then
      v_score := case
        when jsonb_array_length(coalesce(v_lesson.interactive_data->'fields','[]'::jsonb))=0 then 0
        else (
          select round(100.0 * count(*) filter (where length(trim(coalesce(x.value #>> '{}',''))) >= 3)
            / greatest(jsonb_array_length(v_lesson.interactive_data->'fields'),1),2)
          from jsonb_array_elements(coalesce(v_answer->'fields','[]'::jsonb)) x
        )
      end;
      v_ok := jsonb_typeof(v_answer->'fields')='array'
        and jsonb_array_length(v_answer->'fields')=jsonb_array_length(v_lesson.interactive_data->'fields')
        and v_score >= coalesce((v_lesson.interactive_data->>'passingScore')::numeric,80);
    elsif v_type='challenge' then
      v_ok := length(trim(coalesce(v_answer->'fields'->>0,''))) >= 10;
    elsif v_type='' then
      v_ok := true;
    end if;

    if not v_ok then raise exception 'INCORRECT_ANSWER'; end if;
  end if;

  insert into public.lesson_progress(user_id,lesson_id,completed,completed_at,score,last_answer,time_spent_seconds,updated_at)
  values(v_user_id,p_lesson_id,coalesce(p_completed,true),case when coalesce(p_completed,true) then now() else null end,v_score,v_answer,coalesce(p_time_spent_seconds,0),now())
  on conflict(user_id,lesson_id) do update set
    completed=excluded.completed,
    completed_at=excluded.completed_at,
    score=excluded.score,
    last_answer=excluded.last_answer,
    time_spent_seconds=greatest(public.lesson_progress.time_spent_seconds,excluded.time_spent_seconds),
    updated_at=now();

  select * into v_row from public.lesson_progress
  where user_id=v_user_id and lesson_id=p_lesson_id;
  return v_row;
end;
$$;

revoke all on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) from public, anon;
grant execute on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) to authenticated;
