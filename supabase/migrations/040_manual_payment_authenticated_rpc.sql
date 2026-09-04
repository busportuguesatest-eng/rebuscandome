-- Manual payment review is initiated by an authenticated admin request.
-- The functions keep their internal public.is_admin() authorization check,
-- so granting EXECUTE to authenticated does not grant non-admin users access.
grant execute on function public.confirm_manual_payment(uuid,text,text,text) to authenticated;
grant execute on function public.reject_manual_payment(uuid,text) to authenticated;
