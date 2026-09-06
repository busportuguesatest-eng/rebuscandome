-- REBUSCÁNDOME V1 — catálogo único para afiliados activos.
-- Los productos activos deben tener acceso comercial para todos los afiliados activos.
-- affiliate_products queda como override de comisión/estado y como relación de acceso para recursos.

create or replace function public.sync_affiliate_products_for_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.default_commission is distinct from new.default_commission) then
    insert into public.affiliate_products (affiliate_id, product_id, commission_percent, status)
    select a.id, new.id, new.default_commission, 'active'
    from public.affiliates a
    join public.profiles p on p.id = a.profile_id
    where a.status = 'active'
      and p.role = 'affiliate'
      and p.status = 'active'
    on conflict (affiliate_id, product_id) do update
      set commission_percent = coalesce(public.affiliate_products.commission_percent, excluded.commission_percent),
          status = 'active';
  end if;

  if new.status <> 'active' and old.status = 'active' then
    update public.affiliate_products
      set status = 'paused'
    where product_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.sync_affiliate_products_for_affiliate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    insert into public.affiliate_products (affiliate_id, product_id, commission_percent, status)
    select new.id, p.id, p.default_commission, 'active'
    from public.products p
    where p.status = 'active'
    on conflict (affiliate_id, product_id) do update
      set commission_percent = coalesce(public.affiliate_products.commission_percent, excluded.commission_percent),
          status = 'active';
  end if;

  if new.status <> 'active' and old.status = 'active' then
    update public.affiliate_products
      set status = 'paused'
    where affiliate_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_affiliate_products_for_product on public.products;
create trigger trg_sync_affiliate_products_for_product
after insert or update of status, default_commission on public.products
for each row execute function public.sync_affiliate_products_for_product();

drop trigger if exists trg_sync_affiliate_products_for_affiliate on public.affiliates;
create trigger trg_sync_affiliate_products_for_affiliate
after insert or update of status on public.affiliates
for each row execute function public.sync_affiliate_products_for_affiliate();

revoke all on function public.sync_affiliate_products_for_product() from public, anon, authenticated;
revoke all on function public.sync_affiliate_products_for_affiliate() from public, anon, authenticated;

grant execute on function public.sync_affiliate_products_for_product() to service_role;
grant execute on function public.sync_affiliate_products_for_affiliate() to service_role;

-- Backfill para datos existentes del lanzamiento.
insert into public.affiliate_products (affiliate_id, product_id, commission_percent, status)
select a.id, p.id, p.default_commission, 'active'
from public.affiliates a
join public.profiles pr on pr.id = a.profile_id
cross join public.products p
where a.status = 'active'
  and pr.role = 'affiliate'
  and pr.status = 'active'
  and p.status = 'active'
on conflict (affiliate_id, product_id) do update
  set commission_percent = coalesce(public.affiliate_products.commission_percent, excluded.commission_percent),
      status = 'active';
