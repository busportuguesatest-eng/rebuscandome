-- REBUSCÁNDOME — TRACKING PÚBLICO ATÓMICO V1
-- Resuelve el enlace y registra el click en una sola operación segura.

create or replace function public.record_public_affiliate_click(
  p_code text,
  p_visitor_id text default null,
  p_session_id text default null,
  p_ip_hash text default null,
  p_referrer text default null,
  p_user_agent text default null
)
returns table(
  tracking_link_id uuid,
  affiliate_id uuid,
  product_id uuid,
  canonical_code text,
  landing_url text,
  visitor_id uuid,
  click_id uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_link public.tracking_links%rowtype;
  v_product public.products%rowtype;
  v_affiliate public.affiliates%rowtype;
  v_visitor uuid;
  v_click uuid;
  v_normalized text;
begin
  v_normalized := trim(coalesce(p_code, ''));

  if v_normalized = '' then
    raise exception 'TRACKING_CODE_REQUIRED';
  end if;

  select tl.*
    into v_link
  from public.tracking_links tl
  where upper(tl.code) = upper(v_normalized)
    and tl.status = 'active'
  limit 1;

  if v_link.id is null then
    raise exception 'TRACKING_LINK_INVALID';
  end if;

  select p.*
    into v_product
  from public.products p
  where p.id = v_link.product_id
    and p.status = 'active'
  limit 1;

  if v_product.id is null then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;

  select a.*
    into v_affiliate
  from public.affiliates a
  where a.id = v_link.affiliate_id
    and a.status = 'active'
  limit 1;

  if v_affiliate.id is null then
    raise exception 'AFFILIATE_NOT_AVAILABLE';
  end if;

  begin
    v_visitor := nullif(trim(p_visitor_id), '')::uuid;
  exception when others then
    v_visitor := null;
  end;

  if v_visitor is null then
    v_visitor := gen_random_uuid();
  end if;

  insert into public.clicks (
    tracking_link_id,
    affiliate_id,
    product_id,
    visitor_id,
    session_id,
    ip_hash,
    referrer,
    user_agent
  )
  values (
    v_link.id,
    v_link.affiliate_id,
    v_link.product_id,
    v_visitor,
    left(p_session_id, 128),
    left(p_ip_hash, 128),
    left(p_referrer, 1000),
    left(p_user_agent, 1000)
  )
  returning id into v_click;

  return query
  select
    v_link.id,
    v_link.affiliate_id,
    v_link.product_id,
    v_link.code,
    v_product.landing_url,
    v_visitor,
    v_click;
end;
$$;

revoke all
on function public.record_public_affiliate_click(text, text, text, text, text, text)
from public;

grant execute
on function public.record_public_affiliate_click(text, text, text, text, text, text)
to anon, authenticated;

select 'REBUSCÁNDOME: tracking público atómico instalado correctamente' as result;
