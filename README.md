REBUSCÁNDOME — QA 11

Este paquete es incremental y está pensado para aplicarse después de la consolidación previa.

Contenido:
- 021_consolidated_security_repair.sql (versión corregida para instalación limpia)
- 022_access_boundary_hardening.sql
- 023_financial_integrity_hardening.sql
- QA11_NOTES.txt

Orden recomendado en una instalación nueva: 001...020, 021, 022, 023.
En una instalación que ya ejecutó 021/022, aplicar la corrección equivalente pendiente y luego 023; no volver a ejecutar migraciones históricas indiscriminadamente.


## Pago manual V1
Mientras la pasarela externa no esté disponible, el checkout puede operar con Pago Móvil o Transferencia en modo manual. El pedido queda pendiente hasta revisión administrativa; solo al confirmar se genera la venta y comisión.
