-- Rebuscandome V1: manual payment flow while external gateway is unavailable.
-- Creates a protected admin-only confirmation/rejection path for orders paid manually.

create or replace function public.confirm_manual_payment(
  p_order_id uuid,
  p_payment_reference text default null
)
returns table(sale_id uuid, commission_id uuid, order_status text, sale_status text, commission_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_result record;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and payment_method in ('pago_movil','transferencia')
  for update;

  if not found then raise exception 'MANUAL_ORDER_NOT_FOUND'; end if;
  if v_order.status = 'paid' then
    select * into v_result from public.finalize_paid_order(v_order.id);
    return query select v_result.sale_id, v_result.commission_id, v_order.status, v_result.sale_status, v_result.commission_status;
    return;
  end if;
  if v_order.status <> 'pending' then raise exception 'MANUAL_ORDER_NOT_PENDING'; end if;

  update public.orders
  set status='paid',
      payment_provider='manual',
      payment_reference=coalesce(nullif(btrim(p_payment_reference),''), payment_reference),
      updated_at=now()
  where id=v_order.id and status='pending';

  select * into v_result from public.finalize_paid_order(v_order.id);
  return query select v_result.sale_id, v_result.commission_id, 'paid'::text, v_result.sale_status, v_result.commission_status;
end;
$$;

revoke all on function public.confirm_manual_payment(uuid,text) from public, anon, authenticated;


create or replace function public.reject_manual_payment(
  p_order_id uuid,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(left(trim(coalesce(p_reason,'')), 500), '');
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  update public.orders
  set status='cancelled',
      updated_at=now(),
      payment_reference=case
        when v_reason is null then payment_reference
        when payment_reference is null then 'RECHAZADO: ' || v_reason
        else left(payment_reference || ' | RECHAZADO: ' || v_reason, 180)
      end
  where id=p_order_id
    and payment_method in ('pago_movil','transferencia')
    and status='pending'
  returning * into v_order;

  if not found then raise exception 'MANUAL_ORDER_NOT_REJECTABLE'; end if;
  return v_order;
end;
$$;

revoke all on function public.reject_manual_payment(uuid,text) from public, anon, authenticated;
