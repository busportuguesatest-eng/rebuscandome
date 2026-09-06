# Rebuscándome V1 — QA Round 3

## Affiliate
- Fixed `/afiliado/ingresos` authentication lookup to use a robust affiliate + profile check and avoid accidental logout-style redirects caused by a missing/failed single-row query.
- Added a dedicated payment-method registration block in Mis ingresos. The affiliate can register/update Pago Móvil or Transferencia details before requesting a withdrawal.
- Added private Support chat at `/afiliado/soporte`.
- The first support visit automatically creates one private thread and inserts an automatic welcome message.
- Messages are polled periodically so affiliate and admin see new messages without a full page reload.

## Admin
- Added Support inbox at `/admin/soporte` with one conversation thread per affiliate.
- Added Support to the admin sidebar.
- Admin can select a conversation and reply directly.

## Database
- Added `support_threads` and `support_messages` with RLS policies for affiliate-owned threads and active admin access.
- Added a unique thread per affiliate and indexes for recent conversations.
- Production migration applied and verified.
