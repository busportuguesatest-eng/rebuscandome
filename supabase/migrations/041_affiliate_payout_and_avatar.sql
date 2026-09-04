-- REBUSCÁNDOME — perfil de retiros + avatar de afiliado

alter table public.payouts
  add column if not exists payout_channel text,
  add column if not exists payout_bank_name text,
  add column if not exists payout_account text,
  add column if not exists payout_account_type text,
  add column if not exists payout_holder text,
  add column if not exists payout_identifier text,
  add column if not exists payout_phone text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_select on storage.objects;
drop policy if exists avatars_admin_select on storage.objects;

create policy avatars_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy avatars_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy avatars_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy avatars_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and public.is_admin());

create or replace function public.request_affiliate_payout(
  p_amount numeric,
  p_method text
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affiliate_id uuid;
  v_profile public.profiles%rowtype;
  v_payout public.payouts%rowtype;
  v_available numeric(12,2);
  v_left numeric(12,2);
  v_commission record;
  v_take numeric(12,2);
  v_payout_data jsonb;
  v_method text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select a.id, p.* into v_affiliate_id, v_profile
  from public.affiliates a
  join public.profiles p on p.id = a.profile_id
  where a.profile_id = auth.uid() and a.status = 'active' and p.role = 'affiliate' and p.status = 'active'
  limit 1;
  if v_affiliate_id is null then raise exception 'AFFILIATE_NOT_ACTIVE'; end if;
  if p_amount is null or round(p_amount,2) < 20 then raise exception 'MINIMUM_PAYOUT_20'; end if;
  v_method := case when lower(trim(coalesce(p_method,''))) like '%transfer%' then 'transferencia' else 'pago_movil' end;
  v_payout_data := coalesce(v_profile.onboarding_data->'payout', '{}'::jsonb);
  if nullif(trim(coalesce(v_payout_data->>'bank_name','')), '') is null
     or nullif(trim(coalesce(v_payout_data->>'holder','')), '') is null
     or nullif(trim(coalesce(v_payout_data->>'identifier','')), '') is null then
    raise exception 'PAYOUT_PROFILE_INCOMPLETE';
  end if;
  if v_method = 'transferencia' and nullif(trim(coalesce(v_payout_data->>'account','')), '') is null then raise exception 'BANK_ACCOUNT_REQUIRED'; end if;
  if v_method = 'pago_movil' and nullif(trim(coalesce(v_payout_data->>'phone','')), '') is null then raise exception 'PAYMENT_PHONE_REQUIRED'; end if;
  v_left := round(p_amount,2);
  select coalesce(sum(c.amount - c.reserved_amount - c.paid_amount),0) into v_available
  from public.commissions c
  where c.affiliate_id = v_affiliate_id and c.status in ('available','approved') and c.amount - c.reserved_amount - c.paid_amount > 0;
  if v_available < v_left then raise exception 'INSUFFICIENT_AVAILABLE_BALANCE'; end if;
  insert into public.payouts(affiliate_id, amount, method, status, payout_channel, payout_bank_name, payout_account, payout_account_type, payout_holder, payout_identifier, payout_phone)
  values(v_affiliate_id, v_left, v_method, 'requested', v_method, nullif(trim(v_payout_data->>'bank_name'),''), nullif(trim(v_payout_data->>'account'),''), nullif(trim(v_payout_data->>'account_type'),''), nullif(trim(v_payout_data->>'holder'),''), nullif(trim(v_payout_data->>'identifier'),''), nullif(trim(v_payout_data->>'phone'),'') )
  returning * into v_payout;
  for v_commission in
    select c.id, c.amount, c.reserved_amount, c.paid_amount from public.commissions c
    where c.affiliate_id = v_affiliate_id and c.status in ('available','approved') and c.amount - c.reserved_amount - c.paid_amount > 0
    order by c.available_at nulls last, c.created_at, c.id for update
  loop
    exit when v_left <= 0;
    v_take := least(v_left, v_commission.amount - v_commission.reserved_amount - v_commission.paid_amount);
    if v_take <= 0 then continue; end if;
    update public.commissions set reserved_amount = reserved_amount + v_take where id = v_commission.id;
    insert into public.payout_commission_allocations(payout_id, commission_id, amount, status) values(v_payout.id, v_commission.id, v_take, 'reserved');
    v_left := round(v_left - v_take, 2);
  end loop;
  if v_left > 0 then raise exception 'PAYOUT_RESERVATION_INCOMPLETE'; end if;
  return v_payout;
end;
$$;

revoke all on function public.request_affiliate_payout(numeric,text) from public, anon;
grant execute on function public.request_affiliate_payout(numeric,text) to authenticated;

select 'REBUSCÁNDOME: retiros con datos bancarios snapshot + bucket privado de avatares' as result;
