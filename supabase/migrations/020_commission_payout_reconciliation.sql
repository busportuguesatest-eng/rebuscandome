-- REBUSCÁNDOME — ledger de conciliación payout/comisión
-- La lógica transaccional final se normaliza nuevamente en 021.

create table if not exists public.payout_commission_allocations (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved','paid','released')),
  created_at timestamptz not null default now(),
  unique(payout_id, commission_id)
);

create index if not exists idx_payout_allocations_payout
  on public.payout_commission_allocations(payout_id);
create index if not exists idx_payout_allocations_commission
  on public.payout_commission_allocations(commission_id);

alter table public.payout_commission_allocations enable row level security;

create policy payout_allocations_self_read
on public.payout_commission_allocations
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.commissions c
    join public.affiliates a on a.id = c.affiliate_id
    where c.id = payout_commission_allocations.commission_id
      and a.profile_id = auth.uid()
  )
);

create policy payout_allocations_admin_all
on public.payout_commission_allocations
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

select 'REBUSCÁNDOME: ledger payout/comisión creado' as result;
