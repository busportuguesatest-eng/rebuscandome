-- Rebuscándome QA32: dynamic USD/VES quotation engine.
-- Base prices remain in USD; each checkout quote snapshots the current VES rate.

create table if not exists public.payment_quotes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  price_usd numeric(18,2) not null check (price_usd > 0),
  exchange_rate numeric(24,8) not null check (exchange_rate > 0),
  amount_ves numeric(24,2) not null check (amount_ves > 0),
  rate_source text not null check (char_length(btrim(rate_source)) between 2 and 120),
  rate_fetched_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','used','expired','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > rate_fetched_at)
);

create index if not exists payment_quotes_product_idx on public.payment_quotes(product_id, created_at desc);
create index if not exists payment_quotes_status_idx on public.payment_quotes(status, expires_at);
create index if not exists payment_quotes_affiliate_idx on public.payment_quotes(affiliate_id, created_at desc);

alter table public.payment_quotes enable row level security;

revoke all on public.payment_quotes from anon, authenticated;

drop policy if exists payment_quotes_no_direct_access on public.payment_quotes;
create policy payment_quotes_no_direct_access
  on public.payment_quotes
  for all
  to anon, authenticated
  using (false)
  with check (false);

alter table public.orders
  add column if not exists amount_usd numeric(18,2),
  add column if not exists exchange_rate numeric(24,8),
  add column if not exists amount_ves numeric(24,2),
  add column if not exists rate_source text,
  add column if not exists rate_fetched_at timestamptz,
  add column if not exists rate_expires_at timestamptz,
  add column if not exists quote_id uuid references public.payment_quotes(id) on delete set null;

create index if not exists orders_quote_idx on public.orders(quote_id);
create index if not exists orders_rate_snapshot_idx on public.orders(rate_source, rate_fetched_at desc);

update public.orders
set amount_usd = case when currency = 'USD' then amount else amount_usd end
where amount_usd is null;

create or replace function public.mark_payment_quote_status(p_quote_id uuid, p_status text)
returns public.payment_quotes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.payment_quotes;
begin
  if p_status not in ('used','expired','cancelled') then
    raise exception 'INVALID_QUOTE_STATUS';
  end if;

  update public.payment_quotes
  set status = p_status,
      updated_at = now()
  where id = p_quote_id
    and status = 'active'
  returning * into v_quote;

  if not found then
    raise exception 'QUOTE_NOT_ACTIVE';
  end if;

  return v_quote;
end;
$$;

revoke all on function public.mark_payment_quote_status(uuid) from public, anon, authenticated;

-- Internal/service callers only. The application server uses SUPABASE_SECRET_KEY.
