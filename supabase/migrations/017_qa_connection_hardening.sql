-- 017: QA connection hardening
-- Endurece acceso a assets de producto: solo admin o afiliado activo
-- con asignación activa a un producto activo. También corrige Storage.

alter table public.product_assets enable row level security;

drop policy if exists product_assets_select on public.product_assets;
create policy product_assets_select
on public.product_assets
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products p
    join public.affiliate_products ap on ap.product_id = p.id
    join public.affiliates a on a.id = ap.affiliate_id
    join public.profiles pr on pr.id = a.profile_id
    where p.id = product_assets.product_id
      and p.status = 'active'
      and ap.status = 'active'
      and a.status = 'active'
      and pr.id = auth.uid()
      and pr.role = 'affiliate'
      and pr.status = 'active'
  )
);

drop policy if exists product_assets_affiliate_active_products on public.product_assets;
create policy product_assets_affiliate_active_products
on public.product_assets
for select to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.affiliate_products ap on ap.product_id = p.id
    join public.affiliates a on a.id = ap.affiliate_id
    join public.profiles pr on pr.id = a.profile_id
    where p.id = product_assets.product_id
      and p.status = 'active'
      and ap.status = 'active'
      and a.status = 'active'
      and pr.id = auth.uid()
      and pr.role = 'affiliate'
      and pr.status = 'active'
  )
);

drop policy if exists product_assets_storage_affiliate_select on storage.objects;
create policy product_assets_storage_affiliate_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'product-assets'
  and exists (
    select 1
    from public.products p
    join public.affiliate_products ap on ap.product_id = p.id
    join public.affiliates a on a.id = ap.affiliate_id
    join public.profiles pr on pr.id = a.profile_id
    where p.id::text = split_part(storage.objects.name, '/', 1)
      and p.status = 'active'
      and ap.status = 'active'
      and a.status = 'active'
      and pr.id = auth.uid()
      and pr.role = 'affiliate'
      and pr.status = 'active'
  )
);

select 'REBUSCÁNDOME: QA 03 assets + Storage endurecidos' as result;
