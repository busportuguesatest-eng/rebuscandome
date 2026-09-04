-- REBUSCÁNDOME — SOLICITUD DE RETIRO ATÓMICA
-- Cierra el hueco entre la UI de Mis ingresos y la tabla payouts.
-- También impide que un afiliado inserte/reutilice estados de retiro directamente.

create or replace function public.request_affiliate_payout(
  p_amount numeric,
  p_method text
)
returns table(
  id uuid,
  affiliate_id uuid,
  amount numeric,
  method text,
  status text,
  created_at timestamptz,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_affiliate_id uuid;
  v_available numeric;
  v_payout public.payouts%rowtype;
begin
  if p_amount is null or p_amount < 20 then
    raise exception 'MIN_PAYOUT_AMOUNT';
  end if;

  if nullif(trim(coalesce(p_method, '')), '') is null then
    raise exception 'PAYOUT_METHOD_REQUIRED';
  end if;

  if p_method not in ('Pago Móvil', 'Transferencia') then
    raise exception 'PAYOUT_METHOD_INVALID';
  end if;

  select a.id
    into v_affiliate_id
  from public.affiliates a
  join public.profiles pr on pr.id = a.profile_id
  where a.profile_id = auth.uid()
    and a.status = 'active'
    and pr.role = 'affiliate'
    and pr.status = 'active'
  limit 1;

  if v_affiliate_id is null then
    raise exception 'AFFILIATE_NOT_AVAILABLE';
  end if;

  -- Serializa solicitudes del mismo afiliado para evitar doble gasto por concurrencia.
  perform pg_advisory_xact_lock(hashtextextended(v_affiliate_id::text, 0));

  select
    coalesce((
      select sum(c.amount)
      from public.commissions c
      where c.affiliate_id = v_affiliate_id
        and c.status = 'available'
    ), 0)
    - coalesce((
      select sum(p.amount)
      from public.payouts p
      where p.affiliate_id = v_affiliate_id
        and p.status in ('requested','review','approved','processing')
    ), 0)
    into v_available;

  if v_available < p_amount then
    raise exception 'INSUFFICIENT_AVAILABLE_BALANCE';
  end if;

  insert into public.payouts (affiliate_id, amount, method, status)
  values (v_affiliate_id, round(p_amount, 2), trim(p_method), 'requested')
  returning * into v_payout;

  return query
  select v_payout.id, v_payout.affiliate_id, v_payout.amount, v_payout.method,
         v_payout.status, v_payout.created_at, v_payout.paid_at;
end;
$$;

revoke all on function public.request_affiliate_payout(numeric, text) from public;
grant execute on function public.request_affiliate_payout(numeric, text) to authenticated;

drop policy if exists "payouts self create" on public.payouts;

drop policy if exists "payouts self insert" on public.payouts;

select 'REBUSCÁNDOME: retiros afiliado endurecidos y solicitud atómica instalada' as result;
