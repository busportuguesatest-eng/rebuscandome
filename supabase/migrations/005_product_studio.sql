-- REBUSCÁNDOME — Product Studio + Storage
-- Migración alineada con el esquema ejecutado en Supabase.

alter table public.products
  add column if not exists studio_data jsonb not null default '{}'::jsonb;

create index if not exists idx_products_studio_data
  on public.products using gin (studio_data);

create table if not exists public.product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  asset_type text not null check (asset_type in (
    'cover','gallery','thumbnail','video','bonus','promotional','material',
    'script','pdf','ebook','course','delivery','other'
  )),
  file_name text not null,
  original_name text,
  storage_path text not null,
  public_url text,
  mime_type text,
  file_size bigint,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active','inactive','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_assets_product
  on public.product_assets(product_id);
create index if not exists idx_product_assets_type
  on public.product_assets(asset_type);
create index if not exists idx_product_assets_status
  on public.product_assets(status);

alter table public.product_assets enable row level security;

drop trigger if exists trg_product_assets_updated_at on public.product_assets;
create trigger trg_product_assets_updated_at
before update on public.product_assets
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', false)
on conflict (id) do update set public = false;

drop policy if exists product_assets_storage_admin_select on storage.objects;
create policy product_assets_storage_admin_select
on storage.objects
for select to authenticated
using (bucket_id = 'product-assets' and public.is_admin());

drop policy if exists product_assets_storage_admin_insert on storage.objects;
create policy product_assets_storage_admin_insert
on storage.objects
for insert to authenticated
with check (bucket_id = 'product-assets' and public.is_admin());

drop policy if exists product_assets_storage_admin_update on storage.objects;
create policy product_assets_storage_admin_update
on storage.objects
for update to authenticated
using (bucket_id = 'product-assets' and public.is_admin())
with check (bucket_id = 'product-assets' and public.is_admin());

drop policy if exists product_assets_storage_admin_delete on storage.objects;
create policy product_assets_storage_admin_delete
on storage.objects
for delete to authenticated
using (bucket_id = 'product-assets' and public.is_admin());

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
    where ap.product_id = product_assets.product_id
      and a.profile_id = auth.uid()
  )
);

drop policy if exists product_assets_admin_insert on public.product_assets;
create policy product_assets_admin_insert
on public.product_assets
for insert to authenticated
with check (public.is_admin());

drop policy if exists product_assets_admin_update on public.product_assets;
create policy product_assets_admin_update
on public.product_assets
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists product_assets_admin_delete on public.product_assets;
create policy product_assets_admin_delete
on public.product_assets
for delete to authenticated
using (public.is_admin());

select 'REBUSCÁNDOME: Product Studio + Storage alineado correctamente' as result;
