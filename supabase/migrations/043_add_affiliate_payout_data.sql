-- Rebuscándome: datos persistentes para métodos de cobro del afiliado
alter table public.profiles
  add column if not exists onboarding_data jsonb not null default '{}'::jsonb;

create index if not exists profiles_role_status_idx on public.profiles(role, status);
