-- REBUSCÁNDOME — QA12
-- Endurecimiento de fronteras de aplicación.
-- Complementa RLS/SECURITY DEFINER de las migraciones anteriores;
-- no introduce nuevas capacidades comerciales.

-- Las funciones que ejecutan transiciones financieras permanecen fuera del
-- alcance directo del cliente incluso si se vuelve a aplicar una política.
revoke all on function public.finalize_paid_order(uuid) from public, anon, authenticated;
revoke all on function public.reverse_sale_for_refund(uuid) from public, anon, authenticated;
revoke all on function public.mark_payout_paid(uuid) from public, anon, authenticated;
revoke all on function public.reverse_paid_payout(uuid) from public, anon, authenticated;
revoke all on function public.transition_commission_status(uuid,text) from public, anon, authenticated;
revoke all on function public.bootstrap_admin(uuid) from public, anon, authenticated;

-- Refuerzo defensivo de las tablas contables: ningún rol cliente obtiene
-- escritura explícita. Las operaciones legítimas pasan por funciones
-- SECURITY DEFINER o por el panel administrativo bajo RLS.
revoke insert, update, delete on public.sales from anon, authenticated;
revoke insert, update, delete on public.commissions from anon, authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;

select 'REBUSCÁNDOME QA12: application boundary hardening aplicado' as result;


-- Link de afiliado: solo puede existir para una asignación activa.
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

  if not exists (
    select 1 from public.affiliate_products ap
    where ap.affiliate_id = v_affiliate_id
      and ap.product_id = p_product_id
      and ap.status = 'active'
  ) then
    raise exception 'AFFILIATE_PRODUCT_NOT_AVAILABLE';
  end if;

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

select 'REBUSCÁNDOME QA12: application boundary hardening + tracking assignment guard' as result;
