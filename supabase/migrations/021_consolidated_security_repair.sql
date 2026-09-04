-- REBUSCÁNDOME QA09
-- Reparación hacia adelante para instalaciones donde faltan migraciones 008/016
-- y endurecimiento final del ciclo de retiros/comisiones.

-- 1) Asegurar el ledger base incluso si la instalación existente no recibió 016/020.
create table if not exists public.payout_commission_allocations (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved','paid','released')),
  created_at timestamptz not null default now(),
  unique(payout_id, commission_id)
);

alter table public.payout_commission_allocations enable row level security;

-- Completar columnas de reserva/liquidación si la base existente no recibió 016.
alter table public.commissions
  add column if not exists reserved_amount numeric(12,2) not null default 0 check (reserved_amount >= 0),
  add column if not exists paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0);

-- 2) Completar el ledger de asignaciones compatible con 020 y 016.
alter table public.payout_commission_allocations
  add column if not exists status text not null default 'reserved';

-- Normalización de estados heredados.
update public.payout_commission_allocations a
set status = case when p.status = 'paid' then 'paid' else coalesce(a.status, 'reserved') end
from public.payouts p
where p.id = a.payout_id;

-- 3) Evitar que un afiliado cree retiros directos y pueda saltarse la reserva.
drop policy if exists "payouts self create" on public.payouts;

-- 4) Crear/normalizar el motor de solicitud de retiro.
create or replace function public.request_affiliate_payout(
  p_amount numeric,
  p_method text
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_payout public.payouts%rowtype;
  v_available numeric(12,2);
  v_left numeric(12,2);
  v_commission record;
  v_take numeric(12,2);
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select a.id into v_affiliate_id
  from public.affiliates a
  join public.profiles p on p.id = a.profile_id
  where a.profile_id = auth.uid()
    and a.status = 'active'
    and p.role = 'affiliate'
    and p.status = 'active'
  limit 1;

  if v_affiliate_id is null then raise exception 'AFFILIATE_NOT_ACTIVE'; end if;
  if p_amount is null or round(p_amount,2) < 20 then raise exception 'MINIMUM_PAYOUT_20'; end if;
  if nullif(trim(p_method), '') is null then raise exception 'PAYOUT_METHOD_REQUIRED'; end if;

  v_left := round(p_amount,2);

  -- Bloquea las comisiones elegibles durante el cálculo para impedir doble reserva.
  select coalesce(sum(c.amount - c.reserved_amount - c.paid_amount),0)
    into v_available
  from public.commissions c
  where c.affiliate_id = v_affiliate_id
    and c.status in ('available','approved')
    and c.amount - c.reserved_amount - c.paid_amount > 0;

  if v_available < v_left then raise exception 'INSUFFICIENT_AVAILABLE_BALANCE'; end if;

  insert into public.payouts(affiliate_id, amount, method, status)
  values(v_affiliate_id, v_left, trim(p_method), 'requested')
  returning * into v_payout;

  for v_commission in
    select c.id, c.amount, c.reserved_amount, c.paid_amount
    from public.commissions c
    where c.affiliate_id = v_affiliate_id
      and c.status in ('available','approved')
      and c.amount - c.reserved_amount - c.paid_amount > 0
    order by c.available_at nulls last, c.created_at, c.id
    for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_commission.amount - v_commission.reserved_amount - v_commission.paid_amount);
    if v_take <= 0 then continue; end if;

    update public.commissions
      set reserved_amount = reserved_amount + v_take
      where id = v_commission.id;

    insert into public.payout_commission_allocations(payout_id, commission_id, amount, status)
    values(v_payout.id, v_commission.id, v_take, 'reserved');

    v_left := round(v_left - v_take, 2);
  end loop;

  if v_left > 0 then
    raise exception 'PAYOUT_RESERVATION_INCOMPLETE';
  end if;

  return v_payout;
end;
$$;

revoke all on function public.request_affiliate_payout(numeric,text) from public, anon;
grant execute on function public.request_affiliate_payout(numeric,text) to authenticated;

-- 5) Cierre de retiro: pasa reservas a pagadas, de forma idempotente.
create or replace function public.mark_payout_paid(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  v_sum numeric(12,2);
  r record;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_payout
  from public.payouts
  where id = p_payout_id
  for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status = 'paid' then return v_payout; end if;
  if v_payout.status not in ('requested','review','approved','processing') then
    raise exception 'PAYOUT_NOT_PAYABLE: %', v_payout.status;
  end if;

  select coalesce(sum(amount),0) into v_sum
  from public.payout_commission_allocations
  where payout_id = v_payout.id
    and status = 'reserved';

  if v_sum < v_payout.amount then
    raise exception 'PAYOUT_NOT_FULLY_RESERVED';
  end if;

  for r in
    select commission_id, amount
    from public.payout_commission_allocations
    where payout_id = v_payout.id and status = 'reserved'
    for update
  loop
    update public.commissions
      set reserved_amount = greatest(0, reserved_amount - r.amount),
          paid_amount = paid_amount + r.amount,
          paid_at = case when paid_amount + r.amount >= amount then coalesce(paid_at, now()) else paid_at end,
          status = case when paid_amount + r.amount >= amount then 'paid' else status end
      where id = r.commission_id;

    update public.payout_commission_allocations
      set status = 'paid'
      where payout_id = v_payout.id and commission_id = r.commission_id and status = 'reserved';
  end loop;

  update public.payouts
    set status = 'paid', paid_at = coalesce(paid_at, now())
    where id = v_payout.id
    returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.mark_payout_paid(uuid) from public, anon, authenticated;

-- 6) Reversión controlada de un payout pagado.
create or replace function public.reverse_paid_payout(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  r record;
  v_other_paid numeric(12,2);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status <> 'paid' then raise exception 'PAYOUT_NOT_PAID'; end if;

  for r in
    select commission_id, amount
    from public.payout_commission_allocations
    where payout_id = v_payout.id and status = 'paid'
    for update
  loop
    update public.commissions
      set paid_amount = greatest(0, paid_amount - r.amount),
          paid_at = case when greatest(0, paid_amount - r.amount) >= amount then paid_at else null end,
          status = case when greatest(0, paid_amount - r.amount) >= amount then 'paid' else 'available' end
      where id = r.commission_id;
  end loop;

  delete from public.payout_commission_allocations where payout_id = v_payout.id;

  update public.payouts
    set status='incident', paid_at=null
    where id=v_payout.id
    returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.reverse_paid_payout(uuid) from public, anon, authenticated;

-- 7) Asegurar también la función de transición para instalaciones que no hayan aplicado 020.
create or replace function public.transition_commission_status(
  p_commission_id uuid,
  p_status text
) returns public.commissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commission public.commissions%rowtype;
  v_allowed boolean := false;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_commission from public.commissions where id=p_commission_id for update;
  if not found then raise exception 'COMMISSION_NOT_FOUND'; end if;
  v_allowed :=
    (v_commission.status='pending' and p_status in ('approved','reversed'))
    or (v_commission.status='approved' and p_status in ('available','reversed'))
    or (v_commission.status='available' and p_status='reversed')
    or (v_commission.status=p_status);
  if not v_allowed then raise exception 'INVALID_COMMISSION_TRANSITION: % -> %', v_commission.status, p_status; end if;
  update public.commissions
    set status=p_status,
        available_at=case when p_status='available' then coalesce(available_at,now()) else available_at end,
        paid_at=case when p_status='paid' then coalesce(paid_at,now()) else paid_at end
    where id=v_commission.id
    returning * into v_commission;
  return v_commission;
end;
$$;

-- 8) Mantener todas las funciones administrativas sensibles fuera del alcance del cliente.
revoke all on function public.transition_commission_status(uuid,text) from public, anon, authenticated;

select 'REBUSCÁNDOME QA09: dependencias 008/016/020 + payout security repair consolidated' as result;
