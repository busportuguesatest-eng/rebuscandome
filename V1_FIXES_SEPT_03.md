# Rebuscándome V1 — Correcciones de cierre (03 Sep 2026)

## Administrador
- Afiliados: navegación de “Ver perfil” usa el `profile_id` estable y la ruta detalle conserva compatibilidad con affiliate id.
- Productos: miniaturas privadas se resuelven desde `product_assets` con URL firmada; `cover_image` queda como fallback.
- Finanzas: Pago Manual rediseñado en tarjetas, mejor jerarquía, comprobante, referencia, monto y acciones.
- Confirmar Pago: la RPC se ejecuta con el cliente autenticado del admin para preservar `auth.uid()`; migración 040 concede EXECUTE a `authenticated` y la función sigue validando `is_admin()`.
- Ventas, comisiones y retiros: mejor estructura visual, estados y tablas corregidas.
- Formación: botón “Añadir recurso” enlaza directamente al cargador de recursos.

## Checkout
- Diseño compacto premium en dos columnas desktop y responsive en móvil.
- Producto, monto USD/VES, seguridad y vigencia visibles.
- Pago Móvil / Transferencia muestran dinámicamente los datos bancarios antes de registrar el pedido.
- Validación de configuración bancaria según método.
- Carga de referencia y comprobante simplificada.

## Afiliado
- Centro de Venta: selector visible con todos los productos activos y acceso a estrategia/enlace por producto.
- Academia: todos los cursos publicados están desbloqueados.
- Player: todos los módulos/lecciones son navegables, conservando progreso y ruta recomendada.
- Preferencias: pantalla funcional; guarda alertas, recordatorios y sonido en el dispositivo. El sonido se integra con Academia.

## Validación
- `npx tsc --noEmit`: OK, 0 errores.
- `npm run lint`: OK, 0 errores; 9 warnings no bloqueantes.
- `npm run build`: no pudo completarse en el entorno de preparación porque Next.js intentó descargar `@next/swc-linux-x64-gnu` y la red del entorno no tiene acceso a npm. Debe repetirse localmente en Windows antes del push.

## QA ROUND 2 — Correcciones 03 Sep 2026

- Admin Afiliados: navegación de perfil ahora utiliza el `affiliate.id` estable.
- Admin Productos: añadido botón Editar y editor para datos comerciales, precio, comisión, landing y estado.
- Admin Finanzas: tablas financieras con estructura, espaciado y jerarquía visual reforzados; retiros muestran destino bancario capturado.
- Sidebar: eliminado desplazamiento horizontal en hover y refinada la zona de usuario/salida.
- Pago manual: la confirmación usa el cliente autenticado para el RPC; migración 040 ya se había aplicado y quedó preservada.
- Centro de Venta: añadido modal flotante de rendimiento por producto (clicks, ventas, facturación, comisión y conversión).
- Academia: módulos desbloquean progresivamente; siguiente módulo requiere completar todas las lecciones del módulo anterior.
- Mis ingresos: añadido registro inicial/edición de datos bancarios y validación previa al retiro.
- Retiros: el sistema guarda snapshot del destino bancario en `payouts` para que Administración vea dónde enviar el pago solicitado.
- Perfil afiliado: añadido subida de foto mediante bucket privado `avatars` y upload firmado.
- Checkout y entrega: se conserva la entrega por enlace privado enviada por correo; el envío depende de `RESEND_API_KEY` y `EMAIL_FROM` configurados en Vercel.
- Supabase: migraciones 041 y 042 aplicadas en producción; verificadas las columnas de payout, bucket de avatares y permisos del RPC.
