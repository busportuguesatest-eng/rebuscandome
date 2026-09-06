-- REBUSCÁNDOME — production schema alignment + notifications + academy progression
alter table public.materials add column if not exists content text;

alter table public.lesson_progress add column if not exists score numeric(5,2);
alter table public.lesson_progress add column if not exists last_answer jsonb not null default '{}'::jsonb;
alter table public.lesson_progress add column if not exists time_spent_seconds integer not null default 0;
alter table public.lesson_progress add column if not exists updated_at timestamptz not null default now();

alter table public.notifications add column if not exists read_at timestamptz;
update public.notifications set read_at = case when coalesce(read,false) then coalesce(created_at,now()) else null end where read_at is null;
create index if not exists idx_notifications_user_read_at on public.notifications(user_id, read_at, created_at desc);

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
  v_lesson public.lessons%rowtype;
  v_prev_lesson public.lessons%rowtype;
  v_prev_module uuid;
  v_answer jsonb := coalesce(p_last_answer,'{}'::jsonb);
  v_type text;
  v_ok boolean := true;
  v_row public.lesson_progress%rowtype;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_lesson from public.lessons l join public.courses c on c.id=l.course_id
    where l.id=p_lesson_id and l.status='published' and c.status='published' limit 1;
  if not found then raise exception 'LESSON_NOT_AVAILABLE'; end if;
  if coalesce(p_time_spent_seconds,0)<0 then raise exception 'INVALID_TIME_SPENT'; end if;

  -- Sequential lesson rule: prior lesson in the same module, or every lesson in the prior module, must be complete.
  if v_lesson.module_id is not null then
    select * into v_prev_lesson from public.lessons l
      where l.module_id=v_lesson.module_id and l.status='published' and l.position < v_lesson.position
      order by l.position desc limit 1;
    if found and not exists (select 1 from public.lesson_progress lp where lp.user_id=v_user_id and lp.lesson_id=v_prev_lesson.id and coalesce(lp.completed,false)) then
      raise exception 'PREVIOUS_LESSON_REQUIRED';
    end if;
    if not found then
      select cm.id into v_prev_module from public.course_modules cm
        where cm.course_id=v_lesson.course_id and cm.status='published' and cm.position < (select position from public.course_modules where id=v_lesson.module_id)
        order by cm.position desc limit 1;
      if v_prev_module is not null and exists (
        select 1 from public.lessons l where l.module_id=v_prev_module and l.status='published'
        and not exists (select 1 from public.lesson_progress lp where lp.user_id=v_user_id and lp.lesson_id=l.id and coalesce(lp.completed,false))
      ) then raise exception 'PREVIOUS_MODULE_REQUIRED'; end if;
    end if;
  end if;

  if coalesce(p_completed,true) then
    v_type := coalesce(v_lesson.interactive_data->>'type','');
    if v_type in ('multiple_choice','builder_choice','chat_simulation') then
      v_ok := (v_answer->>'selectedIndex') is not null and (v_answer->>'selectedIndex')::int = coalesce((v_lesson.interactive_data->>'correctIndex')::int,-999);
    elsif v_type='sequence' then
      v_ok := (v_answer->'selectedOrder') = (v_lesson.interactive_data->'correctOrder');
    elsif v_type='classification' then
      v_ok := (v_answer->'selectedCategories') is not null and jsonb_array_length(v_answer->'selectedCategories') = jsonb_array_length(v_lesson.interactive_data->'items')
        and not exists (
          select 1 from jsonb_array_elements(v_lesson.interactive_data->'items') with ordinality i(item,idx)
          where coalesce(v_answer->'selectedCategories'->(i.idx-1)->>0,'') <> coalesce(i.item->>'answer','')
        );
    elsif v_type='pairing' then
      v_ok := (v_answer->'selectedPairs') is not null and jsonb_array_length(v_answer->'selectedPairs') = jsonb_array_length(v_lesson.interactive_data->'pairs')
        and not exists (
          select 1 from jsonb_array_elements(v_answer->'selectedPairs') with ordinality x(value,idx)
          where (x.value)::text <> (x.idx-1)::text
        );
    elsif v_type='checklist' then
      v_ok := (v_answer->'checkedItems') is not null and jsonb_array_length(v_answer->'checkedItems') = jsonb_array_length(v_lesson.interactive_data->'items')
        and not exists (select 1 from jsonb_array_elements(v_answer->'checkedItems') x where x.value::text <> 'true');
    elsif v_type in ('builder','planner','final_builder') then
      v_ok := (v_answer->'fields') is not null and jsonb_array_length(v_answer->'fields') = coalesce(jsonb_array_length(v_lesson.interactive_data->'fields'),1)
        and not exists (select 1 from jsonb_array_elements(v_answer->'fields') x where length(trim(coalesce(x.value #>> '{}',''))) < 3);
    elsif v_type='challenge' then
      v_ok := length(trim(coalesce(v_answer->'fields'->>0,''))) >= 10;
    end if;
    if not v_ok then raise exception 'INCORRECT_ANSWER'; end if;
  end if;

  insert into public.lesson_progress(user_id,lesson_id,completed,completed_at,score,last_answer,time_spent_seconds,updated_at)
  values(v_user_id,p_lesson_id,coalesce(p_completed,true),case when coalesce(p_completed,true) then now() else null end,p_score,v_answer,coalesce(p_time_spent_seconds,0),now())
  on conflict(user_id,lesson_id) do update set
    completed=excluded.completed,
    completed_at=excluded.completed_at,
    score=excluded.score,
    last_answer=excluded.last_answer,
    time_spent_seconds=greatest(public.lesson_progress.time_spent_seconds,excluded.time_spent_seconds),
    updated_at=now();
  select * into v_row from public.lesson_progress where user_id=v_user_id and lesson_id=p_lesson_id;
  return v_row;
end;
$$;
revoke all on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) from public, anon;
grant execute on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) to authenticated;

create or replace function public.notify_active_admins(p_type text,p_title text,p_message text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications(user_id,type,title,message,read_at,created_at)
  select p.id,p_type,p_title,p_message,null,now()
  from public.profiles p where p.role='admin' and p.status='active';
end;
$$;
revoke all on function public.notify_active_admins(text,text,text) from public,anon,authenticated;
grant execute on function public.notify_active_admins(text,text,text) to service_role;

create or replace function public.notify_support_message() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_name text; begin if new.sender_role='affiliate' then select p.full_name into v_name from public.support_threads st join public.affiliates a on a.id=st.affiliate_id join public.profiles p on p.id=a.profile_id where st.id=new.thread_id; perform public.notify_active_admins('support','Nuevo mensaje de soporte',coalesce(v_name,'Un afiliado')||' envió un nuevo mensaje.'); end if; return new; end; $$;
drop trigger if exists trg_support_notification on public.support_messages;
create trigger trg_support_notification after insert on public.support_messages for each row execute function public.notify_support_message();

create or replace function public.notify_payout_request() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_name text; begin select p.full_name into v_name from public.affiliates a join public.profiles p on p.id=a.profile_id where a.id=new.affiliate_id; perform public.notify_active_admins('payout','Nueva solicitud de retiro',coalesce(v_name,'Un afiliado')||' solicitó un retiro de $'||to_char(new.amount,'FM999999990.00')||'.'); return new; end; $$;
drop trigger if exists trg_payout_notification on public.payouts;
create trigger trg_payout_notification after insert on public.payouts for each row execute function public.notify_payout_request();

create or replace function public.notify_sale_created() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_product text; v_name text; begin select name into v_product from public.products where id=new.product_id; perform public.notify_active_admins('sale','Nueva venta confirmada',coalesce(v_product,'Producto')||' · $'||to_char(new.gross_amount,'FM999999990.00')||'.'); if new.affiliate_id is not null then select profile_id into v_name from public.affiliates where id=new.affiliate_id; if v_name is not null then insert into public.notifications(user_id,type,title,message,read_at,created_at) values(v_name,'sale','Venta confirmada','Tu venta de '||coalesce(v_product,'producto')||' fue registrada. Comisión: $'||to_char(new.commission_amount,'FM999999990.00')||'.',null,now()); end if; end if; return new; end; $$;
drop trigger if exists trg_sale_notification on public.sales;
create trigger trg_sale_notification after insert on public.sales for each row execute function public.notify_sale_created();

