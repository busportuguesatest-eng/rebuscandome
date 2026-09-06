# REBUSCÁNDOME — QA17 TEST MATRIX

## Objetivo
Convertir los invariantes financieros en pruebas reproducibles antes del E2E real.

### Autenticación / privilegios
- Afiliado autenticado no puede ejecutar `mark_payout_paid`.
- Afiliado autenticado no puede ejecutar `reverse_paid_payout`.
- Afiliado autenticado no puede ejecutar `finalize_paid_order`.
- Admin autenticado sí puede ejecutar `mark_payout_paid` y `reverse_paid_payout`.

### Idempotencia
- Ejecutar `finalize_paid_order` dos veces para la misma orden no crea segunda sale/comisión.
- Ejecutar `mark_payout_paid` dos veces sobre payout pagado retorna el mismo payout sin duplicar allocations.
- Ejecutar `reverse_paid_payout` sobre payout no pagado falla.

### Concurrencia
- Dos solicitudes de payout simultáneas del mismo afiliado deben serializarse por el lock de `affiliates`.
- Dos pagos simultáneos sobre distintos payouts del mismo afiliado no pueden consumir la misma capacidad de comisión más de una vez.
- Si un payout pierde fondos disponibles durante el procesamiento, toda su transacción revierte y el payout no queda `paid`.

### Integridad financiera
- Comisión pagada no vuelve a estar disponible.
- Allocation total de una comisión nunca supera `commissions.amount`.
- Payout pagado debe tener allocations que sumen exactamente `payout.amount`.
- Refund de venta con comisión ya pagada/reservada debe bloquearse.
- Reversión de payout elimina solo sus allocations y reabre una comisión únicamente si no tiene allocations restantes.

### UI/API
- Solicitud de retiro inválida devuelve error no sensible.
- Admin sin permisos recibe 403.
- Error interno SQL no se expone literalmente al cliente salvo códigos de negocio explícitos.
