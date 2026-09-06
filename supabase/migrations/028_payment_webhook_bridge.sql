-- Production bridge: payment provider webhook -> paid order -> existing finalization engine.
-- Backend-only RPC. The HTTP endpoint authenticates the provider webhook separately.

create unique index if not exists customers_email_lower_uidx
  on public.customers (lower(btrim(email)));

create or replace function public.ingest_paid_order(
  p_payment_provider text,
  p_provider_order_id text,
  p_product_id uuid,
  p_affiliate_id uuid,
  p_amount numeric,
  p_currency text,
  p_customer_email text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_country text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders%rowtype;
  v_customer_id uuid;
  v_order public.orders%rowtype;
  v_provider text := lower(trim(coalesce(p_payment_provider,'')));
  v_provider_order_id text := trim(coalesce(p_provider_order_id,''));
  v_currency text := upper(trim(coalesce(p_currency,'')));
  v_email text := lower(trim(coalesce(p_customer_email,'')));
begin
  if v_provider = '' then raise exception 'PAYMENT_PROVIDER_REQUIRED'; end if;
  if length(v_provider) > 64 then raise exception 'PAYMENT_PROVIDER_INVALID'; end if;
  if v_provider_order_id = '' then raise exception 'PROVIDER_ORDER_ID_REQUIRED'; end if;
  if length(v_provider_order_id) > 255 then raise exception 'PROVIDER_ORDER_ID_INVALID'; end if;
  if p_product_id is null then raise exception 'PRODUCT_ID_REQUIRED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
  if p_amount <> round(p_amount::numeric,2) then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'PAYMENT_CURRENCY_INVALID'; end if;
  if v_email = '' or length(v_email) > 320 then raise exception 'CUSTOMER_EMAIL_INVALID'; end if;

  select * into v_existing
  from public.orders
  where lower(payment_provider) = v_provider
    and provider_order_id = v_provider_order_id
  for update;

  if found then
    if v_existing.product_id <> p_product_id
       or coalesce(v_existing.affiliate_id,'00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(p_affiliate_id,'00000000-0000-0000-0000-000000000000'::uuid)
       or v_existing.amount <> round(p_amount::numeric,2)
       or upper(v_existing.currency) <> v_currency then
      raise exception 'PROVIDER_ORDER_CONFLICT';
    end if;
    return v_existing;
  end if;

  if not exists (select 1 from public.products where id=p_product_id and status='active') then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;

  if p_affiliate_id is not null then
    if not exists (
      select 1
      from public.affiliate_products ap
      join public.affiliates a on a.id=ap.affiliate_id
      join public.profiles pr on pr.id=a.profile_id
      where ap.affiliate_id=p_affiliate_id
        and ap.product_id=p_product_id
        and ap.status='active'
        and a.status='active'
        and pr.role='affiliate'
        and pr.status='active'
    ) then
      raise exception 'AFFILIATE_ATTRIBUTION_NOT_ELIGIBLE';
    end if;
  end if;

  insert into public.customers(email,name,phone,country)
  values(v_email,nullif(trim(p_customer_name),''),nullif(trim(p_customer_phone),''),nullif(trim(p_customer_country),''))
  on conflict ((lower(btrim(email)))) do update set
    name=coalesce(excluded.name,customers.name),
    phone=coalesce(excluded.phone,customers.phone),
    country=coalesce(excluded.country,customers.country),
    updated_at=now()
  returning id into v_customer_id;

  insert into public.orders(customer_id,product_id,affiliate_id,amount,currency,payment_provider,provider_order_id,status)
  values(v_customer_id,p_product_id,p_affiliate_id,round(p_amount::numeric,2),v_currency,v_provider,v_provider_order_id,'paid')
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.ingest_paid_order(text,text,uuid,uuid,numeric,text,text,text,text,text) from public, anon, authenticated;
