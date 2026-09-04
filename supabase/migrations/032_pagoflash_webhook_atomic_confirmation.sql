-- QA35: atomically confirm PagoFlash callbacks and finalize financial records.
create or replace function public.confirm_pagoflash_payment(
  p_order_id uuid,
  p_provider_reference text default null,
  p_paid_at timestamptz default null
)
returns table(sale_id uuid, commission_id uuid, sale_status text, commission_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_result record;
begin
  if p_order_id is null then raise exception 'ORDER_ID_REQUIRED'; end if;
  select o.* into v_order
  from public.orders o
  where o.id = p_order_id and o.payment_provider = 'pagoflash'
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  if v_order.status = 'refunded' then raise exception 'ORDER_REFUNDED'; end if;
  if v_order.status = 'pending' then
    update public.orders
    set status='paid',
        payment_reference=coalesce(nullif(btrim(p_provider_reference),''), payment_reference),
        updated_at=now()
    where id=v_order.id and status='pending';
  elsif v_order.status <> 'paid' then
    raise exception 'ORDER_STATUS_INVALID';
  end if;
  select * into v_result from public.finalize_paid_order(v_order.id);
  return query select v_result.sale_id,v_result.commission_id,v_result.sale_status,v_result.commission_status;
end;
$$;
revoke all on function public.confirm_pagoflash_payment(uuid,text,timestamptz) from public, anon, authenticated;
