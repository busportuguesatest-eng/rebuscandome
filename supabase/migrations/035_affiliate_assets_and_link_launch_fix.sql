-- REBUSCÁNDOME V1 — Fix de recursos y generación de enlaces para lanzamiento.
-- 1) Los afiliados activos pueden leer assets de productos activos.
-- 2) Los afiliados activos pueden solicitar URLs firmadas del bucket privado.
-- 3) El backend crea enlaces con service role, evitando depender de una RPC frágil.

alter table public.product_assets enable row level security;

drop policy if exists product_assets_affiliate_active_products on public.product_assets;
create policy product_assets_affiliate_active_products
on public.product_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.products p
    join public.profiles pr on pr.id = auth.uid()
    where p.id = product_assets.product_id
      and p.status = 'active'
      and pr.role = 'affiliate'
      and pr.status = 'active'
  )
);

drop policy if exists product_assets_storage_affiliate_select on storage.objects;
create policy product_assets_storage_affiliate_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-assets'
  and exists (
    select 1
    from public.products p
    join public.profiles pr on pr.id = auth.uid()
    where pr.role = 'affiliate'
      and pr.status = 'active'
      and p.status = 'active'
      and storage.objects.name like (p.id::text || '/%')
  )
);

-- Los enlaces se crean por API con service role después de validar al afiliado.
-- Se conserva la RPC histórica por compatibilidad con instalaciones anteriores.
