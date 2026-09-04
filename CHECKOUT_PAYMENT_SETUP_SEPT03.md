# Checkout + métodos de pago

- Checkout rediseñado para mostrar el método seleccionado con datos bancarios dinámicos.
- Los datos de Pago Móvil y Transferencia viven en `payment_method_settings` y pueden gestionarse desde Administración > Configuración.
- No se almacenan datos reales en el repositorio.
- El checkout bloquea el avance si el método seleccionado no está configurado y validado.
- Se conserva fallback por variables de entorno para compatibilidad con despliegues anteriores.

## Configuración real

En producción, el administrador debe completar los datos desde `/admin/configuracion` o definir las variables de entorno equivalentes.


## QA payment configuration
Production payment settings were updated from the values supplied by the owner. Sensitive bank values are intentionally not duplicated in source control. Pago Móvil requires bank + identifier + phone; Transferencia requires bank + account + holder.
