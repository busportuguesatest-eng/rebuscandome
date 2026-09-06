# Rebuscándome V1 — cierre de lanzamiento

## Flujo comercial obligatorio

Afiliado → enlace → landing → checkout embebido → pago manual → comprobante + referencia → Admin verifica → venta + comisión → acceso privado → entrega → email.

## Variables obligatorias de V1

- `NEXT_PUBLIC_SITE_URL`
- `MANUAL_PAYMENT_BANK_NAME`
- `MANUAL_PAYMENT_ACCOUNT`
- `MANUAL_PAYMENT_HOLDER`
- `MANUAL_PAYMENT_IDENTIFIER`
- `MANUAL_PAYMENT_PHONE`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Checkout embebible

```html
<button data-rebus-product="PRODUCT_ID" data-rebus-affiliate="AFFILIATE_ID">Comprar ahora</button>
<script src="https://rebuscandome.vercel.app/checkout.js" defer></script>
```

El botón abre el checkout central en un modal/iframe. La landing externa no contiene lógica sensible de pago.

## Prueba mínima antes de lanzamiento

1. Crear/usar un producto activo con al menos un asset de entrega (`ebook`, `delivery` o `bonus`).
2. Generar enlace como afiliado.
3. Abrir `/go/[code]` y verificar redirect a la landing.
4. Abrir checkout.
5. Crear orden manual.
6. Subir comprobante + referencia.
7. Confirmar desde Admin.
8. Verificar `sales` y `commissions`.
9. Abrir `access_url` y descargar el recurso.
10. Verificar email de confirmación.
