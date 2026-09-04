# Rebuscandome — Production Release

## Verified locally by owner
- npm run lint: 0 errors (8 warnings)
- npm run build: PASS
- Next.js: 16.3.4
- TypeScript: 6.0.2
- ESLint: 9.39.5

## Required production environment variables
Public:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- NEXT_PUBLIC_SITE_URL

Server-only:
- SUPABASE_SECRET_KEY
- PAGOFLASH_ENV=prod
- PAGOFLASH_BASE_URL=https://pagoflash.com/payment-gateway-commerce
- PAGOFLASH_USERNAME
- PAGOFLASH_PASSWORD
- PAGOFLASH_WEBHOOK_TOKEN
- PAYMENT_WEBHOOK_SECRET
- FX_RATE_URL
- FX_RATE_API_KEY (when required by provider)
- FX_RATE_SOURCE
- FX_QUOTE_TTL_MINUTES=15

## Vercel
- Framework: Next.js
- Install command: npm ci
- Build command: npm run build
- Preview must use PagoFlash QA credentials/endpoints.
- Production must use PagoFlash production credentials/endpoints.
- Configure variables separately for Production and Preview.

## Final acceptance test
1. Affiliate tracking link resolves through /go/[code].
2. Checkout creates a fresh USD/VES quote.
3. Pending order is created from quote.
4. PagoFlash order is created.
5. Successful payment callback reaches /api/webhooks/payment/pagoflash/[token].
6. Payment is atomically confirmed.
7. Sale + commission are created once.
8. Replayed callback is idempotent.
9. Affiliate available balance updates according to commission lifecycle.
10. Payout request reserves only the requested amount.

## Important
Do not paste production secrets into chat. Add them directly in Vercel Project Settings / Environment Variables.
