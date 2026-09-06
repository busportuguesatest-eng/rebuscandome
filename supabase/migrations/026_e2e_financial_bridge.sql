-- REBUSCÁNDOME QA14
-- Puente transaccional para cerrar el flujo E2E financiero.
-- No implementa checkout externo ni webhooks.

create table if not exists public.payout_commission_allocations (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (payout_id, commission_id)
);

create index if not exists idx_payout_allocations_payout on public.payout_commission_allocations(payout_id);
create index if not exists idx_payout_allocations_commission on public.payout_commission_allocations(commission_id);

alter table public.payout_commission_allocations enable row level security;

drop policy if exists "payout allocation self read" on public.payout_commission_allocations;
drop policy if exists "payout allocation admin all" on public.payout_commission_allocations;
create policy "payout allocation self read" on public.payout_commission_allocations
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.commissions c
      join public.affiliates a on a.id = c.affiliate_id
      where c.id = payout_commission_allocations.commission_id
        and a.profile_id = auth.uid()
    )
  );
create policy "payout allocation admin all" on public.payout_commission_allocations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- El cliente nunca escribe directamente sobre el libro de retiros.
drop policy if exists "payouts self create" on public.payouts;

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
  v_affiliate public.affiliates%rowtype;
  v_payout public.payouts%rowtype;
  v_available numeric(12,2);
  v_amount numeric(12,2);
begin
  v_amount := round(coalesce(p_amount, 0)::numeric, 2);
  if v_amount < 20 then raise exception 'PAYOUT_MINIMUM_20'; end if;
  if v_amount <> coalesce(p_amount, 0)::numeric then raise exception 'PAYOUT_AMOUNT_INVALID'; end if;
  if nullif(trim(p_method), '') is null then raise exception 'PAYOUT_METHOD_REQUIRED'; end if;
  if trim(p_method) not in ('Pago Móvil', 'Transferencia') then raise exception 'PAYOUT_METHOD_INVALID'; end if;

  select * into v_affiliate
  from public.affiliates
  where profile_id = auth.uid() and status = 'active'
  for update;
  if not found then raise exception 'AFFILIATE_NOT_AVAILABLE'; end if;

  select greatest(
    0,
    coalesce(sum(case when c.status = 'available' then c.amount else 0 end), 0)
      - coalesce((select sum(a.amount) from public.payout_commission_allocations a
                 join public.commissions c2 on c2.id = a.commission_id
                 where c2.affiliate_id = v_affiliate.id), 0)
      - coalesce((select sum(p.amount) from public.payouts p
                 where p.affiliate_id = v_affiliate.id
                   and p.status in ('requested','review','approved','processing')), 0)
  ) into v_available
  from public.commissions c
  where c.affiliate_id = v_affiliate.id;

  if v_amount > v_available then raise exception 'PAYOUT_EXCEEDS_AVAILABLE'; end if;

  insert into public.payouts (affiliate_id, amount, method, status)
  values (v_affiliate.id, v_amount, trim(p_method), 'requested')
  returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.request_affiliate_payout(numeric,text) from public, anon;
grant execute on function public.request_affiliate_payout(numeric,text) to authenticated;

-- Marca un retiro como pagado y asigna FIFO contra comisiones disponibles.
create or replace function public.mark_payout_paid(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  v_remaining numeric(12,2);
  v_capacity numeric(12,2);
  v_alloc numeric(12,2);
  v_allocated numeric(12,2);
  v_comm public.commissions%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status = 'paid' then return v_payout; end if;
  if v_payout.status not in ('requested','review','approved','processing') then
    raise exception 'PAYOUT_STATUS_INVALID';
  end if;

  v_remaining := v_payout.amount;

  for v_comm in
    select c.*
    from public.commissions c
    where c.affiliate_id = v_payout.affiliate_id
      and c.status = 'available'
    order by c.available_at nulls last, c.created_at, c.id
    for update
  loop
    exit when v_remaining <= 0;

    select coalesce(sum(a.amount), 0) into v_allocated
    from public.payout_commission_allocations a
    where a.commission_id = v_comm.id;

    v_capacity := greatest(v_comm.amount - v_allocated, 0);
    if v_capacity <= 0 then continue; end if;

    v_alloc := least(v_remaining, v_capacity);
    insert into public.payout_commission_allocations (payout_id, commission_id, amount)
    values (v_payout.id, v_comm.id, v_alloc)
    on conflict (payout_id, commission_id) do update set amount = excluded.amount;

    v_remaining := round(v_remaining - v_alloc, 2);

    select coalesce(sum(a.amount), 0) into v_allocated
    from public.payout_commission_allocations a
    where a.commission_id = v_comm.id;

    if v_allocated >= v_comm.amount then
      update public.commissions
      set status = 'paid', paid_at = now()
      where id = v_comm.id;
    end if;
  end loop;

  if v_remaining > 0 then raise exception 'PAYOUT_FUNDS_CHANGED'; end if;

  update public.payouts
  set status = 'paid', paid_at = now()
  where id = v_payout.id
  returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.mark_payout_paid(uuid) from public, anon, authenticated;

create or replace function public.reverse_paid_payout(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  v_alloc record;
  v_remaining numeric(12,2);
  v_other_paid numeric(12,2);
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_payout from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status <> 'paid' then raise exception 'PAYOUT_NOT_PAID'; end if;

  for v_alloc in
    select commission_id, amount from public.payout_commission_allocations
    where payout_id = v_payout.id
  loop
    delete from public.payout_commission_allocations
    where payout_id = v_payout.id and commission_id = v_alloc.commission_id;

    select coalesce(sum(a.amount), 0) into v_other_paid
    from public.payout_commission_allocations a
    where a.commission_id = v_alloc.commission_id;

    if v_other_paid = 0 then
      update public.commissions
      set status = 'available', paid_at = null, available_at = coalesce(available_at, now())
      where id = v_alloc.commission_id and status = 'paid';
    end if;
  end loop;

  update public.payouts
  set status = 'incident', paid_at = null
  where id = v_payout.id
  returning * into v_payout;

  return v_payout;
end;
$$;

revoke all on function public.reverse_paid_payout(uuid) from public, anon, authenticated;

select 'REBUSCÁNDOME QA14: puente E2E financiero protegido' as result;
