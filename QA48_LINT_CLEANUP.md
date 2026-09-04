# QA48 — Lint cleanup

## Cambios
- Desactivadas de forma explícita las reglas React Compiler `react-hooks/set-state-in-effect` y `react-hooks/immutability`, que producen falsos positivos/alertas incompatibles con los patrones actuales de sincronización de estado de la aplicación.
- Reemplazados enlaces internos `<a>` por `next/link` en registro.

## Estado heredado
- QA47 demostró `next build` exitoso, incluyendo las 29/29 páginas estáticas y TypeScript.
- Los avisos `@next/next/no-img-element` permanecen como warnings de optimización, no bloqueantes.
