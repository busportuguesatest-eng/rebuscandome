-- REBUSCÁNDOME — Tracking Resilience V1
-- Endurece el registro de clicks y evita errores por cookies antiguas/no UUID.

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
  v_visitor_id uuid;
begin
  select affiliate_id, product_id
    into v_affiliate_id, v_product_id
  from public.tracking_links
  where id = p_tracking_link_id
    and status = 'active';

  if v_affiliate_id is null then
    raise exception 'TRACKING_LINK_INVALID';
  end if;

  -- Cookies antiguas o externas pueden no contener un UUID válido.
  -- En ese caso generamos un nuevo identificador estable para la visita.
  begin
    v_visitor_id := nullif(trim(p_visitor_id), '')::uuid;
  exception when others then
    v_visitor_id := gen_random_uuid();
  end;

  if v_visitor_id is null then
    v_visitor_id := gen_random_uuid();
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
    v_visitor_id,
    left(p_session_id, 128),
    left(p_ip_hash, 128),
    left(p_referrer, 1000),
    left(p_user_agent, 1000)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all
on function public.track_affiliate_click(uuid, text, text, text, text, text)
from public;

grant execute
on function public.track_affiliate_click(uuid, text, text, text, text, text)
to anon, authenticated;

select 'REBUSCÁNDOME: tracking resiliente instalado correctamente' as result;

-- Limpieza de enlaces legacy generados por versiones anteriores.
-- Solo corrige códigos con el patrón antiguo '---', sin tocar enlaces válidos.
update public.tracking_links tl
set code = upper(
  regexp_replace(
    a.affiliate_code || '-' || p.slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    '[^A-Z0-9-]',
    '-',
    'g'
  )
)
from public.affiliates a
join public.products p on p.id = tl.product_id
where tl.affiliate_id = a.id
  and tl.code like '%---%';

select 'REBUSCÁNDOME: enlaces legacy normalizados' as result;
