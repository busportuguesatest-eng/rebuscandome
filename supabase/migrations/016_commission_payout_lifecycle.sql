-- REBUSCÁNDOME — ciclo de reserva/liquidación financiera
-- Prepara las columnas que utiliza el motor de payouts sin conceder escrituras directas.

alter table public.commissions
  add column if not exists reserved_amount numeric(12,2) not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0;

alter table public.commissions
  drop constraint if exists commissions_reserved_nonnegative;
alter table public.commissions
  add constraint commissions_reserved_nonnegative check (reserved_amount >= 0) not valid;

alter table public.commissions
  drop constraint if exists commissions_paid_nonnegative;
alter table public.commissions
  add constraint commissions_paid_nonnegative check (paid_amount >= 0) not valid;

create index if not exists idx_commissions_affiliate_available
  on public.commissions(affiliate_id, status, available_at, created_at);

select 'REBUSCÁNDOME: ciclo de payouts preparado' as result;
