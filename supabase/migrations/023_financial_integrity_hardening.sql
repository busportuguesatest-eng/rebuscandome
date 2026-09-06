-- REBUSCÁNDOME QA11
-- Integridad financiera y de atribución.
-- Este archivo endurece el punto order paid -> sale -> commission y añade
-- reversión administrativa controlada. No integra ningún proveedor de pago.

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
  v_affiliate_active boolean := false;
  v_commission_percent numeric(5,2) := 0;
  v_commission_amount numeric(12,2) := 0;
  v_platform_amount numeric(12,2) := 0;
begin
  if p_order_id is null then raise exception 'ORDER_ID_REQUIRED'; end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'paid' then raise exception 'ORDER_NOT_PAID'; end if;
  if v_order.amount is null or v_order.amount <= 0 then raise exception 'ORDER_AMOUNT_INVALID'; end if;

  -- Idempotencia: una orden solo puede originar una venta.
  select * into v_sale from public.sales where order_id = v_order.id;
  if found then
    select * into v_commission from public.commissions where sale_id = v_sale.id;
    return query select v_sale.id, v_commission.id, v_sale.status, coalesce(v_commission.status, 'none');
    return;
  end if;

  if v_order.affiliate_id is not null then
    -- Un afiliado ya desactivado o sin asignación activa no puede generar
    -- una comisión nueva. Se rechaza explícitamente para no pagar atribución inválida.
    select exists (
      select 1
      from public.affiliate_products ap
      join public.affiliates a on a.id = ap.affiliate_id
      join public.profiles pr on pr.id = a.profile_id
      join public.products p on p.id = ap.product_id
      where ap.affiliate_id = v_order.affiliate_id
        and ap.product_id = v_order.product_id
        and ap.status = 'active'
        and a.status = 'active'
        and pr.role = 'affiliate'
        and pr.status = 'active'
    ) into v_affiliate_active;

    if not v_affiliate_active then
      raise exception 'AFFILIATE_ATTRIBUTION_NOT_ELIGIBLE';
    end if;

    select greatest(0, least(100, coalesce(ap.commission_percent, p.default_commission, 0)))
      into v_commission_percent
    from public.products p
    join public.affiliate_products ap
      on ap.product_id = p.id
     and ap.affiliate_id = v_order.affiliate_id
     and ap.status = 'active'
    where p.id = v_order.product_id;

    v_commission_percent := coalesce(v_commission_percent, 0);
    v_commission_amount := round(v_order.amount * v_commission_percent / 100, 2);
  end if;

  v_platform_amount := round(v_order.amount - v_commission_amount, 2);

  insert into public.sales (
    order_id, product_id, affiliate_id, gross_amount, commission_percent,
    commission_amount, platform_amount, currency, status, confirmed_at
  ) values (
    v_order.id, v_order.product_id, v_order.affiliate_id, v_order.amount,
    v_commission_percent, v_commission_amount, v_platform_amount,
    v_order.currency, 'confirmed', now()
  ) returning * into v_sale;

  if v_order.affiliate_id is not null and v_commission_amount > 0 then
    insert into public.commissions (sale_id, affiliate_id, amount, status)
    values (v_sale.id, v_order.affiliate_id, v_commission_amount, 'pending')
    returning * into v_commission;
  end if;

  return query select v_sale.id, v_commission.id, v_sale.status, coalesce(v_commission.status, 'none');
end;
$$;

revoke all on function public.finalize_paid_order(uuid) from public, anon, authenticated;

-- Reversión financiera controlada. Solo administración puede ejecutarla.
-- No permite revertir una venta cuya comisión ya haya sido pagada o tenga saldo
-- reservado: primero debe deshacerse el payout correspondiente.
create or replace function public.reverse_sale_for_refund(p_order_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_commission public.commissions%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_sale
  from public.sales
  where order_id = p_order_id
  for update;

  if not found then raise exception 'SALE_NOT_FOUND'; end if;
  if v_sale.status = 'reversed' then return v_sale; end if;

  select * into v_commission
  from public.commissions
  where sale_id = v_sale.id
  for update;

  if found then
    if coalesce(v_commission.paid_amount, 0) > 0
       or coalesce(v_commission.reserved_amount, 0) > 0
       or v_commission.status = 'paid' then
      raise exception 'COMMISSION_HAS_PAYOUT_EXPOSURE';
    end if;

    update public.commissions
      set status = 'reversed',
          reserved_amount = 0
      where id = v_commission.id;
  end if;

  update public.sales
    set status = 'reversed'
    where id = v_sale.id
    returning * into v_sale;

  update public.orders
    set status = 'refunded', updated_at = now()
    where id = v_sale.order_id;

  return v_sale;
end;
$$;

revoke all on function public.reverse_sale_for_refund(uuid) from public, anon, authenticated;

-- Integridad mínima para nuevas escrituras contables.
-- NOT VALID evita romper instalaciones existentes que aún requieren limpieza;
-- las aplicaciones nuevas quedan cubiertas por estos triggers/constraints.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_amount_positive'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_amount_positive check (amount > 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_amounts_nonnegative'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_amounts_nonnegative
      check (gross_amount > 0 and commission_amount >= 0 and platform_amount >= 0)
      not valid;
  end if;
end $$;

select 'REBUSCÁNDOME QA11: integridad financiera y atribución endurecidas' as result;
