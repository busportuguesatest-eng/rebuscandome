-- Rebuscandome QA06
-- Motor interno: order paid -> sale -> commission.
-- El proveedor de pago/webhook queda deliberadamente fuera de esta migración.

create or replace function public.finalize_paid_order(p_order_id uuid)
returns table (
  sale_id uuid,
  commission_id uuid,
  sale_status text,
  commission_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_sale public.sales%rowtype;
  v_commission public.commissions%rowtype;
  v_commission_percent numeric(5,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_platform_amount numeric(12,2) := 0;
begin
  if p_order_id is null then
    raise exception 'ORDER_ID_REQUIRED';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'paid' then
    raise exception 'ORDER_NOT_PAID';
  end if;

  -- Idempotencia: una orden solo puede originar una venta.
  select * into v_sale
  from public.sales
  where order_id = v_order.id;

  if found then
    select * into v_commission
    from public.commissions
    where sale_id = v_sale.id;

    return query
      select v_sale.id,
             v_commission.id,
             v_sale.status,
             coalesce(v_commission.status, 'none');
    return;
  end if;

  if v_order.affiliate_id is not null then
    select coalesce(ap.commission_percent, p.default_commission)
      into v_commission_percent
    from public.products p
    left join public.affiliate_products ap
      on ap.product_id = p.id
     and ap.affiliate_id = v_order.affiliate_id
     and ap.status = 'active'
    where p.id = v_order.product_id;

    v_commission_percent := greatest(0, least(100, coalesce(v_commission_percent, 0)));
    v_commission_amount := round(v_order.amount * v_commission_percent / 100, 2);
  end if;

  v_platform_amount := round(v_order.amount - v_commission_amount, 2);

  insert into public.sales (
    order_id,
    product_id,
    affiliate_id,
    gross_amount,
    commission_percent,
    commission_amount,
    platform_amount,
    currency,
    status,
    confirmed_at
  )
  values (
    v_order.id,
    v_order.product_id,
    v_order.affiliate_id,
    v_order.amount,
    v_commission_percent,
    v_commission_amount,
    v_platform_amount,
    v_order.currency,
    'confirmed',
    now()
  )
  returning * into v_sale;

  if v_order.affiliate_id is not null and v_commission_amount > 0 then
    insert into public.commissions (
      sale_id,
      affiliate_id,
      amount,
      status
    )
    values (
      v_sale.id,
      v_order.affiliate_id,
      v_commission_amount,
      'pending'
    )
    returning * into v_commission;
  end if;

  return query
    select v_sale.id,
           v_commission.id,
           v_sale.status,
           coalesce(v_commission.status, 'none');
end;
$$;

revoke all on function public.finalize_paid_order(uuid) from public;
revoke all on function public.finalize_paid_order(uuid) from anon;
revoke all on function public.finalize_paid_order(uuid) from authenticated;

-- Solo el backend con privilegios explícitos debe invocar este motor.
-- No se concede EXECUTE a roles cliente.
