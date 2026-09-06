create table if not exists public.payment_method_settings (
  id uuid primary key default gen_random_uuid(),
  method text not null check (method in ('pago_movil','transferencia')),
  enabled boolean not null default true,
  bank_name text not null default '',
  account text not null default '',
  account_type text not null default '',
  holder text not null default '',
  identifier text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now(),
  unique(method)
);

alter table public.payment_method_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='payment_method_settings' and policyname='payment_method_settings_admin_all') then
    create policy payment_method_settings_admin_all on public.payment_method_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

insert into public.payment_method_settings (method, enabled)
values ('pago_movil', true), ('transferencia', true)
on conflict (method) do nothing;

create index if not exists payment_method_settings_method_idx on public.payment_method_settings(method);
