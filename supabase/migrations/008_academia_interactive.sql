-- REBUSCÁNDOME — Academia interactiva
-- Crea la estructura que las migraciones 009–012 y el reproductor utilizan.

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  slug text not null,
  description text not null default '',
  position integer not null default 1 check (position > 0),
  estimated_minutes integer not null default 15 check (estimated_minutes > 0),
  icon text,
  color_key text,
  required_previous_module_id uuid references public.course_modules(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, slug),
  unique(course_id, position)
);

create index if not exists idx_course_modules_course_position
  on public.course_modules(course_id, position);

alter table public.lessons
  add column if not exists module_id uuid references public.course_modules(id) on delete cascade,
  add column if not exists lesson_type text not null default 'content',
  add column if not exists estimated_minutes integer not null default 7,
  add column if not exists objective text,
  add column if not exists key_points jsonb not null default '[]'::jsonb,
  add column if not exists interactive_data jsonb not null default '{}'::jsonb;

create index if not exists idx_lessons_module_position
  on public.lessons(module_id, position);

-- Persistencia ampliada del progreso.
alter table public.lesson_progress
  add column if not exists score numeric(5,2),
  add column if not exists last_answer jsonb not null default '{}'::jsonb,
  add column if not exists time_spent_seconds integer not null default 0;

alter table public.lesson_progress
  drop constraint if exists lesson_progress_score_range;
alter table public.lesson_progress
  add constraint lesson_progress_score_range
  check (score is null or (score >= 0 and score <= 100)) not valid;

alter table public.lesson_progress
  drop constraint if exists lesson_progress_time_spent_nonnegative;
alter table public.lesson_progress
  add constraint lesson_progress_time_spent_nonnegative
  check (time_spent_seconds >= 0) not valid;

alter table public.course_modules enable row level security;

-- Reemplaza la política amplia heredada de 001 para impedir que un usuario
-- marque como avanzado progreso sobre lecciones que todavía no están publicadas.
drop policy if exists "progress self all" on public.lesson_progress;
create policy progress_self_published
on public.lesson_progress
for all to authenticated
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_progress.lesson_id
        and l.status = 'published'
        and c.status = 'published'
    )
  )
)
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_progress.lesson_id
        and l.status = 'published'
        and c.status = 'published'
    )
  )
);

 drop policy if exists course_modules_published_read on public.course_modules;
create policy course_modules_published_read
on public.course_modules
for select to authenticated
using (status = 'published' or public.is_admin());

 drop policy if exists course_modules_admin_all on public.course_modules;
create policy course_modules_admin_all
on public.course_modules
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Los nuevos campos del lesson quedan igualmente bajo las políticas ya existentes;
-- solo se añade la escritura/lectura de progreso mediante una función transaccional.
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
set search_path = public
as $$
declare
  v_row public.lesson_progress%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_lesson_id is null then raise exception 'LESSON_ID_REQUIRED'; end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then raise exception 'INVALID_SCORE'; end if;
  if coalesce(p_time_spent_seconds,0) < 0 then raise exception 'INVALID_TIME_SPENT'; end if;

  if not exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id
      and l.status = 'published'
      and c.status = 'published'
  ) then
    raise exception 'LESSON_NOT_AVAILABLE';
  end if;

  insert into public.lesson_progress(user_id, lesson_id, completed_at, score, last_answer, time_spent_seconds)
  values (
    v_user_id,
    p_lesson_id,
    case when coalesce(p_completed,true) then now() else null end,
    p_score,
    coalesce(p_last_answer, '{}'::jsonb),
    coalesce(p_time_spent_seconds,0)
  )
  on conflict(user_id, lesson_id) do update set
    completed_at = excluded.completed_at,
    score = excluded.score,
    last_answer = excluded.last_answer,
    time_spent_seconds = greatest(public.lesson_progress.time_spent_seconds, excluded.time_spent_seconds);

  select * into v_row
  from public.lesson_progress
  where user_id = v_user_id and lesson_id = p_lesson_id;
  return v_row;
end;
$$;

revoke all on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) from public, anon;
grant execute on function public.save_lesson_progress(uuid,boolean,numeric,jsonb,integer) to authenticated;

select 'REBUSCÁNDOME: Academia interactiva / migración 008 consolidada' as result;
