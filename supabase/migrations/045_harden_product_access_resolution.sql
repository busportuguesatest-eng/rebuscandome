-- Harden private delivery resolution: resolve directly against the access row and preserve active access semantics.
create or replace function public.resolve_product_access(p_token_hash text)
returns table(access_id uuid, order_id uuid, customer_id uuid, product_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(p_token_hash),'') is null then
    raise exception 'ACCESS_TOKEN_REQUIRED';
  end if;
  return query
    update public.product_access
       set last_used_at = now()
     where token_hash = p_token_hash
       and status = 'active'
    returning id, order_id, customer_id, product_id;
end;
$$;
revoke all on function public.resolve_product_access(text) from public, anon, authenticated;
