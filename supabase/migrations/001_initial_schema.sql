create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  country text default 'VE',
  role text not null default 'affiliate' check (role in ('affiliate','admin')),
  status text not null default 'active' check (status in ('active','inactive','suspended','blocked')),
  avatar_url text,
  onboarding_completed boolean not null default false,
  onboarding_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  affiliate_code text not null unique,
  default_commission numeric(5,2) not null default 60 check (default_commission >= 0 and default_commission <= 100),
  status text not null default 'active' check (status in ('active','inactive','suspended','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  description text not null default '',
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'USD',
  default_commission numeric(5,2) not null default 60 check (default_commission >= 0 and default_commission <= 100),
  landing_url text,
  cover_image text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  commission_percent numeric(5,2),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now(),
  unique (affiliate_id, product_id)
);

create table if not exists public.tracking_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null unique,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.clicks (
  id uuid primary key default gen_random_uuid(),
  tracking_link_id uuid not null references public.tracking_links(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  visitor_id text not null,
  session_id text,
  ip_hash text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  phone text,
  country text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  product_id uuid not null references public.products(id),
  affiliate_id uuid references public.affiliates(id),
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  payment_provider text,
  provider_order_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  affiliate_id uuid references public.affiliates(id),
  gross_amount numeric(12,2) not null,
  commission_percent numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  platform_amount numeric(12,2) not null,
  currency text not null default 'USD',
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','available','paid','reversed')),
  available_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id),
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  reference text,
  status text not null default 'requested' check (status in ('requested','review','approved','processing','paid','rejected','incident','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  type text not null default 'general' check (type in ('general','product_specific')),
  product_id uuid references public.products(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text not null default '',
  video_url text,
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  title text not null,
  type text not null,
  file_url text,
  content text,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_clicks_affiliate_created on public.clicks(affiliate_id, created_at desc);
create index if not exists idx_sales_affiliate_created on public.sales(affiliate_id, created_at desc);
create index if not exists idx_sales_product_created on public.sales(product_id, created_at desc);
create index if not exists idx_commissions_affiliate_status on public.commissions(affiliate_id, status);
create index if not exists idx_payouts_affiliate_status on public.payouts(affiliate_id, status);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read_at, created_at desc);

alter table public.profiles enable row level security;
alter table public.affiliates enable row level security;
alter table public.products enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.tracking_links enable row level security;
alter table public.clicks enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.sales enable row level security;
alter table public.commissions enable row level security;
alter table public.payouts enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.materials enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active');
$$;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "profiles admin all" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate self read" on public.affiliates for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy "affiliate admin all" on public.affiliates for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products published read" on public.products for select to authenticated using (status = 'active' or public.is_admin());
create policy "products admin all" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "affiliate products self read" on public.affiliate_products for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "affiliate products admin all" on public.affiliate_products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "tracking links self read" on public.tracking_links for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "tracking links admin all" on public.tracking_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "clicks self read" on public.clicks for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "clicks admin all" on public.clicks for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "sales self read" on public.sales for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "sales admin all" on public.sales for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "commissions self read" on public.commissions for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "commissions admin all" on public.commissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "payouts self read" on public.payouts for select to authenticated using (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()) or public.is_admin());
create policy "payouts self create" on public.payouts for insert to authenticated with check (affiliate_id in (select id from public.affiliates where profile_id = auth.uid()));
create policy "payouts admin all" on public.payouts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "courses published read" on public.courses for select to authenticated using (status = 'published' or public.is_admin());
create policy "courses admin all" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lessons published read" on public.lessons for select to authenticated using (status = 'published' or public.is_admin());
create policy "lessons admin all" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "progress self all" on public.lesson_progress for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "materials published read" on public.materials for select to authenticated using (status = 'published' or public.is_admin());
create policy "materials admin all" on public.materials for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "notifications self read" on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "notifications self update" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "notifications admin insert" on public.notifications for insert to authenticated with check (public.is_admin());

-- Bootstrap profile automatically after Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  clean_name text;
  base_code text;
  final_code text;
  suffix integer := 0;
begin
  clean_name := coalesce(new.raw_user_meta_data->>'full_name', 'Afiliado');
  insert into public.profiles (id, full_name, phone, role, status)
  values (new.id, clean_name, new.raw_user_meta_data->>'phone', 'affiliate', 'active');

  base_code := upper(regexp_replace(split_part(coalesce(new.email, 'affiliate'), '@', 1), '[^a-zA-Z0-9]', '', 'g'));
  base_code := left(case when base_code = '' then 'AFF' else base_code end, 8);
  final_code := base_code;
  while exists (select 1 from public.affiliates where affiliate_code = final_code) loop
    suffix := suffix + 1;
    final_code := left(base_code, greatest(1, 8 - length(suffix::text))) || suffix::text;
  end loop;

  insert into public.affiliates (profile_id, affiliate_code)
  values (new.id, final_code);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
