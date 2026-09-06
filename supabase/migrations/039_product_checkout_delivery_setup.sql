-- Rebuscándome V1: product-level checkout code and delivery readiness.
alter table public.products
  add column if not exists checkout_code text,
  add column if not exists delivery_enabled boolean not null default true;

create unique index if not exists idx_products_checkout_code_unique
  on public.products(checkout_code)
  where checkout_code is not null;

create or replace function public.generate_product_checkout_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
begin
  if nullif(trim(new.checkout_code), '') is not null then
    new.checkout_code := upper(trim(new.checkout_code));
    return new;
  end if;
  loop
    candidate := 'RBCHK-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12));
    exit when not exists (select 1 from public.products where checkout_code = candidate);
  end loop;
  new.checkout_code := candidate;
  return new;
end;
$$;

drop trigger if exists trg_products_checkout_code on public.products;
create trigger trg_products_checkout_code
before insert on public.products
for each row execute function public.generate_product_checkout_code();

update public.products
set checkout_code = 'RBCHK-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12))
where checkout_code is null;

-- Backfill is collision-safe because each generated value is random and the unique index protects the column.
create index if not exists idx_products_delivery_enabled on public.products(delivery_enabled) where delivery_enabled = true;

revoke all on function public.generate_product_checkout_code() from public, anon, authenticated;
