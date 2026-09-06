-- Allow PayPal as a checkout payment method and provider.
create or replace function public.create_pending_order_from_quote(
  p_quote_id uuid,
  p_payment_method text,
  p_customer_email text,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_country text default 'UN'
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.payment_quotes%rowtype;
  v_customer_id uuid;
  v_order public.orders%rowtype;
  v_email text := lower(trim(coalesce(p_customer_email,'')));
  v_method text := lower(trim(coalesce(p_payment_method,'')));
begin
  if v_method not in ('paypal','pagoflash','c2p','pago_movil') then raise exception 'PAYMENT_METHOD_INVALID'; end if;
  if v_email = '' or length(v_email) > 320 then raise exception 'CUSTOMER_EMAIL_INVALID'; end if;
  select * into v_quote from public.payment_quotes where id=p_quote_id for update;
  if not found then raise exception 'QUOTE_NOT_FOUND'; end if;
  if v_quote.status <> 'active' then raise exception 'QUOTE_NOT_ACTIVE'; end if;
  if v_quote.expires_at <= now() then update public.payment_quotes set status='expired',updated_at=now() where id=v_quote.id and status='active'; raise exception 'QUOTE_EXPIRED'; end if;
  if not exists(select 1 from public.products where id=v_quote.product_id and status='active') then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;
  insert into public.customers(email,name,phone,country)
  values(v_email,nullif(trim(p_customer_name),''),nullif(trim(p_customer_phone),''),nullif(trim(coalesce(p_customer_country,'')),'UN'))
  on conflict ((lower(btrim(email)))) do update set name=coalesce(excluded.name,customers.name),phone=coalesce(excluded.phone,customers.phone),country=coalesce(excluded.country,customers.country)
  returning id into v_customer_id;
  insert into public.orders(customer_id,product_id,affiliate_id,amount,currency,payment_provider,provider_order_id,status,amount_usd,exchange_rate,amount_ves,rate_source,rate_fetched_at,rate_expires_at,quote_id,payment_method)
  values(v_customer_id,v_quote.product_id,v_quote.affiliate_id,v_quote.amount_ves,'VES',null,null,'pending',v_quote.price_usd,v_quote.exchange_rate,v_quote.amount_ves,v_quote.rate_source,v_quote.rate_fetched_at,v_quote.expires_at,v_quote.id,v_method)
  returning * into v_order;
  update public.payment_quotes set status='used',updated_at=now() where id=v_quote.id and status='active';
  return v_order;
end; $$;
revoke all on function public.create_pending_order_from_quote(uuid,text,text,text,text,text) from public,anon,authenticated;

create or replace function public.attach_payment_provider_order(p_order_id uuid,p_payment_provider text,p_provider_order_id text,p_payment_url text default null,p_payment_reference text default null)
returns public.orders language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.orders; v_provider text:=lower(btrim(coalesce(p_payment_provider,''))); v_provider_id text:=btrim(coalesce(p_provider_order_id,''));
begin
 if v_provider not in ('paypal','pagoflash','chinchin','cobrix') then raise exception 'PAYMENT_PROVIDER_INVALID'; end if;
 if v_provider_id='' or length(v_provider_id)>180 then raise exception 'PROVIDER_ORDER_ID_INVALID'; end if;
 update public.orders set payment_provider=v_provider,provider_order_id=v_provider_id,payment_url=nullif(btrim(coalesce(p_payment_url,'')),''),payment_reference=nullif(btrim(coalesce(p_payment_reference,'')),''),updated_at=now() where id=p_order_id and status='pending' and payment_provider is null and provider_order_id is null returning * into v_order;
 if not found then raise exception 'ORDER_NOT_ATTACHABLE'; end if; return v_order;
end; $$;
revoke all on function public.attach_payment_provider_order(uuid,text,text,text,text) from public,anon,authenticated;
