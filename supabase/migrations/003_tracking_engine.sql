-- REBUSCÁNDOME - TRACKING ENGINE V1
-- Ejecutar después de 001_initial_schema.sql y 002_admin_singleton.sql

create or replace function public.track_affiliate_click(
  p_tracking_link_id uuid,
  p_visitor_id text,
  p_session_id text default null,
  p_ip_hash text default null,
  p_referrer text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_affiliate_id uuid;
  v_product_id uuid;
begin
  select affiliate_id, product_id
    into v_affiliate_id, v_product_id
  from public.tracking_links
  where id = p_tracking_link_id
    and status = 'active';

  if v_affiliate_id is null then
    raise exception 'TRACKING_LINK_INVALID';
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
  ) values (
    p_tracking_link_id,
    v_affiliate_id,
    v_product_id,
    left(coalesce(p_visitor_id, gen_random_uuid()::text), 128),
    left(p_session_id, 128),
    left(p_ip_hash, 128),
    left(p_referrer, 1000),
    left(p_user_agent, 1000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.track_affiliate_click(uuid, text, text, text, text, text) from public;
grant execute on function public.track_affiliate_click(uuid, text, text, text, text, text) to anon, authenticated;

-- Los afiliados pueden crear únicamente su propio enlace mediante el endpoint/API.
-- No se expone INSERT directo sobre tracking_links al cliente.
drop policy if exists "tracking links self insert" on public.tracking_links;

-- Asegura integridad de URLs de landing: solo HTTPS o rutas relativas permitidas.
alter table public.products
drop constraint if exists products_landing_url_safe;

alter table public.products
add constraint products_landing_url_safe
check (
  landing_url is null
  or landing_url ~* '^https://'
  or landing_url ~ '^/'
);


create or replace function public.create_tracking_link(p_product_id uuid)
returns table(id uuid, code text, product_id uuid, affiliate_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_code text;
  v_slug text;
begin
  select a.id into v_affiliate_id
  from public.affiliates a
  where a.profile_id = auth.uid()
    and a.status = 'active';

  if v_affiliate_id is null then
    raise exception 'AFFILIATE_NOT_AVAILABLE';
  end if;

  select p.slug into v_slug
  from public.products p
  where p.id = p_product_id
    and p.status = 'active';

  if v_slug is null then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;

  select tl.id, tl.code, tl.product_id, tl.affiliate_id, tl.status
    into id, code, product_id, affiliate_id, status
  from public.tracking_links tl
  where tl.affiliate_id = v_affiliate_id
    and tl.product_id = p_product_id
  limit 1;

  if id is not null then
    return next;
    return;
  end if;

  v_code := upper(regexp_replace((select a.affiliate_code from public.affiliates a where a.id = v_affiliate_id) || '-' || v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6), '[^A-Z0-9-]', '', 'g'));

  insert into public.tracking_links (affiliate_id, product_id, code, status)
  values (v_affiliate_id, p_product_id, v_code, 'active')
  returning tracking_links.id, tracking_links.code, tracking_links.product_id, tracking_links.affiliate_id, tracking_links.status
  into id, code, product_id, affiliate_id, status;

  return next;
end;
$$;

revoke all on function public.create_tracking_link(uuid) from public;
grant execute on function public.create_tracking_link(uuid) to authenticated;
