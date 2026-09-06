# PayPal checkout setup

The checkout now exposes PayPal to every country and Pago Móvil only when the server detects Venezuela through Vercel geolocation headers.

Configure in Vercel:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com` for QA
- `PAYPAL_BASE_URL=https://api-m.paypal.com` for production

The PayPal REST calls stay server-side. The browser only receives the public client ID through `/api/checkout/paypal/config`; the client secret never leaves the server.

Before production, create a PayPal business account appropriate for your country and validate the exact receiving/withdrawal capabilities and currencies available to that account.
