-- REBUSCÁNDOME — QA10
-- Aislamiento de acceso entre afiliados y administración.
-- Los afiliados solo pueden leer recursos de productos que realmente tienen asignados.

alter table public.product_assets enable row level security;

drop policy if exists product_assets_select on public.product_assets;
create policy product_assets_select
on public.product_assets
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.affiliate_products ap
    join public.affiliates a on a.id = ap.affiliate_id
    join public.products p on p.id = ap.product_id
    join public.profiles pr on pr.id = a.profile_id
    where ap.product_id = product_assets.product_id
      and a.profile_id = auth.uid()
      and a.status = 'active'
      and ap.status = 'active'
      and pr.role = 'affiliate'
      and pr.status = 'active'
      and p.status = 'active'
  )
);

drop policy if exists product_assets_affiliate_active_products on public.product_assets;
create policy product_assets_affiliate_active_products
on public.product_assets
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.affiliate_products ap
    join public.affiliates a on a.id = ap.affiliate_id
    join public.products p on p.id = ap.product_id
    join public.profiles pr on pr.id = a.profile_id
    where ap.product_id = product_assets.product_id
      and a.profile_id = auth.uid()
      and a.status = 'active'
      and ap.status = 'active'
      and pr.role = 'affiliate'
      and pr.status = 'active'
      and p.status = 'active'
  )
);

-- Storage privado: un afiliado no puede enumerar/descargar archivos de productos
-- que no tenga asignados.
drop policy if exists product_assets_storage_affiliate_select on storage.objects;
create policy product_assets_storage_affiliate_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'product-assets'
  and exists (
    select 1
    from public.affiliate_products ap
    join public.affiliates a on a.id = ap.affiliate_id
    join public.products p on p.id = ap.product_id
    join public.profiles pr on pr.id = a.profile_id
    where a.profile_id = auth.uid()
      and ap.product_id::text = split_part(storage.objects.name, '/', 1)
      and a.status = 'active'
      and ap.status = 'active'
      and pr.role = 'affiliate'
      and pr.status = 'active'
      and p.status = 'active'
  )
);

-- Las operaciones contables sensibles siguen siendo administradas exclusivamente
-- por políticas/RPC de administración; no se añaden permisos de escritura a afiliados.
-- Explicitamente documentamos que no existe una política INSERT/UPDATE/DELETE para
-- sales, commissions u orders destinada a afiliados.

select 'REBUSCÁNDOME QA10: límites de acceso de afiliados reforzados' as result;
