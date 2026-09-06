-- REBUSCÁNDOME V1 — todos los afiliados activos pueden vender productos activos.
-- Mantiene affiliate_products como override opcional de comisión/estado.

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
  v_commission numeric(5,2);
  v_assignment_status text;
begin
  select a.id into v_affiliate_id
  from public.affiliates a
  join public.profiles pr on pr.id = a.profile_id
  where a.profile_id = auth.uid()
    and a.status = 'active'
    and pr.role = 'affiliate'
    and pr.status = 'active'
  limit 1;

  if v_affiliate_id is null then raise exception 'AFFILIATE_NOT_AVAILABLE'; end if;

  select p.slug into v_slug
  from public.products p
  where p.id = p_product_id
    and p.status = 'active';
  if v_slug is null then raise exception 'PRODUCT_NOT_AVAILABLE'; end if;

  select coalesce(ap.commission_percent, p.default_commission), coalesce(ap.status, 'active')
    into v_commission, v_assignment_status
  from public.products p
  left join public.affiliate_products ap
    on ap.product_id = p.id and ap.affiliate_id = v_affiliate_id
  where p.id = p_product_id
    and p.status = 'active';

  if v_assignment_status <> 'active' then
    raise exception 'AFFILIATE_PRODUCT_NOT_AVAILABLE';
  end if;

  insert into public.affiliate_products (affiliate_id, product_id, commission_percent, status)
  values (v_affiliate_id, p_product_id, v_commission, 'active')
  on conflict (affiliate_id, product_id) do update
    set commission_percent = coalesce(public.affiliate_products.commission_percent, excluded.commission_percent),
        status = 'active';

  select tl.id, tl.code, tl.product_id, tl.affiliate_id, tl.status
    into id, code, product_id, affiliate_id, status
  from public.tracking_links tl
  where tl.affiliate_id = v_affiliate_id
    and tl.product_id = p_product_id
    and tl.status = 'active'
  limit 1;

  if id is not null then return next; return; end if;

  v_code := upper(regexp_replace(
    (select a.affiliate_code from public.affiliates a where a.id = v_affiliate_id)
    || '-' || v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
    '[^A-Z0-9-]', '', 'g'
  ));

  insert into public.tracking_links (affiliate_id, product_id, code, status)
  values (v_affiliate_id, p_product_id, v_code, 'active')
  returning tracking_links.id, tracking_links.code, tracking_links.product_id,
            tracking_links.affiliate_id, tracking_links.status
  into id, code, product_id, affiliate_id, status;

  return next;
end;
$$;

revoke all on function public.create_tracking_link(uuid) from public, anon;
grant execute on function public.create_tracking_link(uuid) to authenticated;
