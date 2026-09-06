-- REBUSCÁNDOME QA17
-- Corrige permisos de ejecución de RPC financieros y deja la matriz de invariantes.

-- Las funciones mantienen su propia comprobación is_admin();
-- authenticated necesita EXECUTE para que el endpoint pueda invocarlas.
revoke execute on function public.mark_payout_paid(uuid) from public, anon;
grant execute on function public.mark_payout_paid(uuid) to authenticated;

revoke execute on function public.reverse_paid_payout(uuid) from public, anon;
grant execute on function public.reverse_paid_payout(uuid) to authenticated;

-- El motor de finalización de órdenes se reserva para backend privilegiado.
-- No se concede ejecución al cliente.
revoke execute on function public.finalize_paid_order(uuid) from public, anon, authenticated;

-- Reversión de venta: solo admin, la propia función valida is_admin().
revoke execute on function public.reverse_sale_for_refund(uuid) from public, anon;
grant execute on function public.reverse_sale_for_refund(uuid) to authenticated;

select 'REBUSCÁNDOME QA17: grants financieros corregidos' as result;
