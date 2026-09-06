# PagoFlash — cierre de integración

## Ya implementado
- Precio comercial en USD y cotización dinámica USD/VES.
- Orden local pendiente creada desde `payment_quotes`.
- Adapter server-side para autenticar PagoFlash y crear la orden.
- `successRedirectUrl` para retorno del cliente.
- `successCallbackUrl` protegido por `PAGOFLASH_WEBHOOK_TOKEN`.
- Confirmación atómica del pago y finalización financiera mediante `confirm_pagoflash_payment()` + `finalize_paid_order()`.
- Persistencia de la referencia real del pago en `orders.payment_reference`.
- Idempotencia mediante el núcleo financiero existente.

## Para probar contra PagoFlash QA
Configurar en el entorno de despliegue:
- `PAGOFLASH_ENV=qa`
- `PAGOFLASH_USERNAME=<credencial QA>`
- `PAGOFLASH_PASSWORD=<credencial QA>`
- `PAGOFLASH_WEBHOOK_TOKEN=<secreto aleatorio de al menos 32 caracteres>`
- `NEXT_PUBLIC_SITE_URL=https://<dominio-publico>`

La API pública de PagoFlash documenta el servidor QA `https://qa.pagoflash.com/payment-gateway-commerce`, el login JWT, `POST /order`, `successRedirectUrl`, `successCallbackUrl` y datos de prueba de Pago Móvil, Transferencia y C2P.

## Prueba final pendiente
1. Desplegar Rebuscándome a una URL pública HTTPS.
2. Configurar credenciales QA de PagoFlash.
3. Abrir `/checkout?product_id=...`.
4. Completar checkout y redirección a PagoFlash.
5. Realizar una operación QA usando los datos publicados por PagoFlash.
6. Comprobar POST real a `/api/webhooks/payment/pagoflash/<TOKEN>`.
7. Verificar que la orden pase `pending -> paid`, que se cree la venta y que la comisión quede registrada.
8. Repetir el callback y verificar que no se duplique la venta/comisión.

## Nota de seguridad
La documentación pública revisada no expone un esquema de firma criptográfica del webhook. Por eso el callback está protegido por un token secreto dedicado en la URL y el servidor vuelve a validar que el `orderId`, `provider_order_id`, estado y monto correspondan a una orden PagoFlash pendiente antes de confirmar.

No se debe declarar producción operativa hasta superar la prueba HTTP real con credenciales QA.
