-- Rebuscándome V1: buyer access + manual payment receipt.
create table if not exists public.product_access (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  token_hash text not null unique,
  token_last4 text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists idx_product_access_customer on public.product_access(customer_id);
create index if not exists idx_product_access_product on public.product_access(product_id);
alter table public.product_access enable row level security;

create table if not exists public.order_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  storage_path text not null,
  original_name text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_payment_receipts_order on public.order_payment_receipts(order_id);
alter table public.order_payment_receipts enable row level security;

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

drop policy if exists payment_receipts_admin_select on storage.objects;
create policy payment_receipts_admin_select on storage.objects for select to authenticated
using (bucket_id = 'payment-receipts' and public.is_admin());

-- No public/client upload policy: receipts are uploaded through the server after same-origin + order validation.

create or replace function public.create_product_access(
  p_order_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_token_hash text,
  p_token_last4 text
)
returns public.product_access
language plpgsql
security definer
set search_path = public
as $$
declare v_access public.product_access;
begin
  if p_order_id is null or p_customer_id is null or p_product_id is null or nullif(trim(p_token_hash),'') is null then
    raise exception 'ACCESS_DATA_REQUIRED';
  end if;
  insert into public.product_access(order_id,customer_id,product_id,token_hash,token_last4,status)
  values(p_order_id,p_customer_id,p_product_id,p_token_hash,left(coalesce(p_token_last4,''),4),'active')
  on conflict (order_id) do update
    set customer_id=excluded.customer_id,
        product_id=excluded.product_id,
        token_hash=excluded.token_hash,
        token_last4=excluded.token_last4,
        status='active';
  select * into v_access from public.product_access where order_id=p_order_id;
  return v_access;
end;
$$;
revoke all on function public.create_product_access(uuid,uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.resolve_product_access(p_token_hash text)
returns table(access_id uuid, order_id uuid, customer_id uuid, product_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_token_hash),'') is null then raise exception 'ACCESS_TOKEN_REQUIRED'; end if;
  return query
    update public.product_access
       set last_used_at=now()
     where token_hash=p_token_hash and status='active'
     returning id, order_id, customer_id, product_id;
end;
$$;
revoke all on function public.resolve_product_access(text) from public, anon, authenticated;

-- Store a paid order's access token hash as part of the finalization transaction when provided.
alter table public.orders add column if not exists access_token_last4 text;

create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_access_token_hash text default null,
  p_access_token_last4 text default null
)
returns table (
  sale_id uuid,
  commission_id uuid,
  sale_status text,
  commission_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_sale public.sales%rowtype;
  v_commission public.commissions%rowtype;
  v_commission_percent numeric(5,2) := 0;
  v_commercial_amount numeric(12,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_platform_amount numeric(12,2) := 0;
  v_currency text := 'USD';
  v_result record;
begin
  if p_order_id is null then raise exception 'ORDER_ID_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'paid' then raise exception 'ORDER_NOT_PAID'; end if;

  select * into v_sale from public.sales where order_id=v_order.id;
  if found then
    if p_access_token_hash is not null then
      perform public.create_product_access(v_order.id,v_order.customer_id,v_order.product_id,p_access_token_hash,p_access_token_last4);
    end if;
    select * into v_commission from public.commissions where sale_id=v_sale.id;
    return query select v_sale.id, v_commission.id, v_sale.status, coalesce(v_commission.status,'none');
    return;
  end if;

  v_commercial_amount := round(coalesce(v_order.amount_usd, v_order.amount), 2);
  v_currency := case when v_order.amount_usd is not null then 'USD' else coalesce(v_order.currency, 'USD') end;
  if v_commercial_amount <= 0 then raise exception 'ORDER_AMOUNT_INVALID'; end if;

  if v_order.affiliate_id is not null then
    select coalesce(ap.commission_percent, p.default_commission)
      into v_commission_percent
    from public.products p
    left join public.affiliate_products ap
      on ap.product_id=p.id and ap.affiliate_id=v_order.affiliate_id and ap.status='active'
    where p.id=v_order.product_id;
    v_commission_percent := greatest(0, least(100, coalesce(v_commission_percent,0)));
    v_commission_amount := round(v_commercial_amount*v_commission_percent/100,2);
  end if;
  v_platform_amount := round(v_commercial_amount-v_commission_amount,2);

  insert into public.sales(order_id,product_id,affiliate_id,gross_amount,commission_percent,commission_amount,platform_amount,currency,status,confirmed_at)
  values(v_order.id,v_order.product_id,v_order.affiliate_id,v_commercial_amount,v_commission_percent,v_commission_amount,v_platform_amount,v_currency,'confirmed',now())
  returning * into v_sale;

  if v_order.affiliate_id is not null and v_commission_amount > 0 then
    insert into public.commissions(sale_id,affiliate_id,amount,status)
    values(v_sale.id,v_order.affiliate_id,v_commission_amount,'pending')
    returning * into v_commission;
  end if;

  if p_access_token_hash is not null then
    perform public.create_product_access(v_order.id,v_order.customer_id,v_order.product_id,p_access_token_hash,p_access_token_last4);
  end if;

  return query select v_sale.id,v_commission.id,v_sale.status,coalesce(v_commission.status,'none');
end;
$$;
revoke all on function public.finalize_paid_order(uuid) from public, anon, authenticated;
revoke all on function public.finalize_paid_order(uuid,text,text) from public, anon, authenticated;

create or replace function public.confirm_manual_payment(
  p_order_id uuid,
  p_payment_reference text default null,
  p_access_token_hash text default null,
  p_access_token_last4 text default null
)
returns table(sale_id uuid, commission_id uuid, order_status text, sale_status text, commission_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_result record;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id and payment_method in ('pago_movil','transferencia') for update;
  if not found then raise exception 'MANUAL_ORDER_NOT_FOUND'; end if;
  if v_order.status = 'paid' then
    select * into v_result from public.finalize_paid_order(v_order.id,p_access_token_hash,p_access_token_last4);
    return query select v_result.sale_id,v_result.commission_id,v_order.status,v_result.sale_status,v_result.commission_status;
    return;
  end if;
  if v_order.status <> 'pending' then raise exception 'MANUAL_ORDER_NOT_PENDING'; end if;
  update public.orders set status='paid', payment_provider='manual', payment_reference=coalesce(nullif(btrim(p_payment_reference),''),payment_reference), access_token_last4=left(coalesce(p_access_token_last4,''),4), updated_at=now() where id=v_order.id and status='pending';
  select * into v_result from public.finalize_paid_order(v_order.id,p_access_token_hash,p_access_token_last4);
  return query select v_result.sale_id,v_result.commission_id,'paid'::text,v_result.sale_status,v_result.commission_status;
end;
$$;
revoke all on function public.confirm_manual_payment(uuid,text) from public, anon, authenticated;
revoke all on function public.confirm_manual_payment(uuid,text,text,text) from public, anon, authenticated;

-- Backwards-compatible wrappers for callers that still use the original signatures.
create or replace function public.finalize_paid_order(p_order_id uuid)
returns table (sale_id uuid, commission_id uuid, sale_status text, commission_status text)
language sql security definer set search_path = public
as $$ select * from public.finalize_paid_order(p_order_id, null, null); $$;
revoke all on function public.finalize_paid_order(uuid) from public, anon, authenticated;

create or replace function public.confirm_manual_payment(p_order_id uuid, p_payment_reference text default null)
returns table(sale_id uuid, commission_id uuid, order_status text, sale_status text, commission_status text)
language sql security definer set search_path = public, pg_temp
as $$ select * from public.confirm_manual_payment(p_order_id, p_payment_reference, null, null); $$;
revoke all on function public.confirm_manual_payment(uuid,text) from public, anon, authenticated;
