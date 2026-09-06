-- QA34: provider bridge for pending checkout orders.
-- Keeps provider identifiers server-side and exposes no direct table access.

alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_url text,
  add column if not exists payment_reference text;

create index if not exists orders_provider_lookup_idx
  on public.orders(payment_provider, provider_order_id)
  where provider_order_id is not null;

create or replace function public.attach_payment_provider_order(
  p_order_id uuid,
  p_payment_provider text,
  p_provider_order_id text,
  p_payment_url text default null,
  p_payment_reference text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_provider text := lower(btrim(coalesce(p_payment_provider,'')));
  v_provider_id text := btrim(coalesce(p_provider_order_id,''));
begin
  if v_provider not in ('pagoflash','chinchin','cobrix') then
    raise exception 'PAYMENT_PROVIDER_INVALID';
  end if;
  if v_provider_id = '' or length(v_provider_id) > 180 then
    raise exception 'PROVIDER_ORDER_ID_INVALID';
  end if;

  update public.orders
  set payment_provider = v_provider,
      provider_order_id = v_provider_id,
      payment_url = nullif(btrim(coalesce(p_payment_url,'')), ''),
      payment_reference = nullif(btrim(coalesce(p_payment_reference,'')), ''),
      updated_at = now()
  where id = p_order_id
    and status = 'pending'
    and payment_provider is null
    and provider_order_id is null
  returning * into v_order;

  if not found then
    raise exception 'ORDER_NOT_ATTACHABLE';
  end if;

  return v_order;
end;
$$;

revoke all on function public.attach_payment_provider_order(uuid,text,text,text,text) from public, anon, authenticated;
