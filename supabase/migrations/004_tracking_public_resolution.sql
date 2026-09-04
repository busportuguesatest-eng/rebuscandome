-- REBUSCÁNDOME — Tracking público seguro
-- Corrige el flujo de enlaces compartidos sin exponer la tabla tracking_links a anon.

create or replace function public.resolve_tracking_link(p_code text)
returns table(
  id uuid,
  affiliate_id uuid,
  product_id uuid,
  code text,
  landing_url text,
  product_status text
)
language sql
security definer
set search_path = public
as $$
  select
    tl.id,
    tl.affiliate_id,
    tl.product_id,
    tl.code,
    p.landing_url,
    p.status
  from public.tracking_links tl
  join public.products p on p.id = tl.product_id
  join public.affiliates a on a.id = tl.affiliate_id
  where tl.code = trim(p_code)
    and tl.status = 'active'
    and p.status = 'active'
    and a.status = 'active'
  limit 1;
$$;

revoke all on function public.resolve_tracking_link(text) from public;
grant execute on function public.resolve_tracking_link(text) to anon, authenticated;

select 'REBUSCÁNDOME: resolución pública de tracking instalada' as result;
