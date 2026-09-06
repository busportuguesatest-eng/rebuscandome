# Rebuscándome — Deployment checklist

## Vercel
1. Importar el repositorio como proyecto Next.js.
2. Node: >= 20.19.0.
3. Configurar Production y Preview por separado.
4. Registrar las variables de `.env.example` en Vercel; nunca subir `.env*` real al repositorio.
5. Production debe usar `PAGOFLASH_ENV=production` y la URL productiva de PagoFlash.
6. `NEXT_PUBLIC_SITE_URL` debe coincidir exactamente con el dominio público HTTPS.

## Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publicable.
- `SUPABASE_SECRET_KEY`: exclusivamente backend.
- Aplicar las migraciones SQL del directorio `supabase/migrations` de forma controlada.
- Verificar Auth, RLS y grants antes de abrir tráfico real.

## PagoFlash
- Crear credenciales reales fuera del chat y fuera del repositorio.
- Configurar `PAGOFLASH_WEBHOOK_TOKEN` con >= 32 caracteres aleatorios.
- Callback: `/api/webhooks/payment/pagoflash/<TOKEN>`.
- Success redirect: `/pago/exito?order=<ORDER_ID>`.
- Confirmación de pago ocurre exclusivamente en servidor mediante el RPC atómico.

## FX
- Configurar `FX_RATE_URL`, `FX_RATE_API_KEY` y `FX_RATE_SOURCE`.
- No usar una tasa fija en producción.
- Verificar que la fuente sea confiable y que la tasa devuelta sea positiva.

## Release gate
Antes de aceptar una venta real:
- `npm ci` PASS.
- `npm run lint` PASS.
- `npm run build` PASS.
- Smoke test de checkout.
- Webhook PagoFlash en QA.
- Prueba de idempotencia.
- Prueba de monto alterado/rechazado.
- Confirmar comisión y saldo después del pago.


## Pago manual V1
Configura en Vercel Production estas variables públicas/no secretas con los datos de la cuenta que recibirá los pagos: MANUAL_PAYMENT_BANK_NAME=<CONFIGURAR_EN_VERCEL>, MANUAL_PAYMENT_ACCOUNT=<CONFIGURAR_EN_VERCEL>, MANUAL_PAYMENT_HOLDER=<CONFIGURAR_EN_VERCEL>, MANUAL_PAYMENT_IDENTIFIER=<CONFIGURAR_EN_VERCEL> y MANUAL_PAYMENT_PHONE=<CONFIGURAR_EN_VERCEL>. El código no contiene valores bancarios reales como respaldo; si faltan las variables, el checkout manual se detiene hasta configurarlas.
