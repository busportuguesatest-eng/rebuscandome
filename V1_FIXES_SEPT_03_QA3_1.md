# Rebuscandome — QA 3.1 fixes

Correcciones de esta ronda:

1. **Mis ingresos / afiliado**
   - La página ya no expulsa al afiliado solo porque falte la fila `affiliates`; mantiene la sesión y muestra el área de ingresos.
   - Se conserva el registro de métodos de pago en la misma sección.

2. **Centro de Venta / rendimiento**
   - El catálogo se limita a productos realmente asignados al afiliado y activos.
   - El rendimiento del producto se calcula solo con clicks y ventas del producto abierto.
   - El botón `Ver rendimiento` abre una ventana flotante/modal con KPIs de clicks, ventas, facturación, comisión y conversión.

3. **Administrador / perfiles**
   - `Ver perfil` deja de depender de navegar a una página que podía fallar visualmente.
   - Ahora abre un modal flotante con datos del afiliado, KPIs, actividad comercial, enlaces, retiros y formación.
   - Se añadió endpoint protegido `GET /api/admin/affiliates/[id]` para cargar el perfil bajo sesión administrativa.

4. **Seguridad**
   - El endpoint de perfil valida sesión, rol `admin` y estado `active`.
   - El endpoint exige same-origin.

Validación: el código fuente fue revisado. La validación ejecutable en este entorno no pudo completarse porque la carpeta `node_modules` quedó incompleta y `npm install` agotó el transporte de red; ejecutar `npm.cmd run lint`, `npx tsc --noEmit` y `npm.cmd run build` en Windows antes del push.
