# Mis ingresos — corrección estructural

- Se confirmó que producción no tenía `profiles.onboarding_data`, pero `/afiliado/ingresos` y el endpoint de métodos de cobro dependían de esa columna.
- Se añadió la columna `profiles.onboarding_data` como JSONB con default `{}` en migración 043 y se aplicó en producción.
- `/afiliado/ingresos` ahora usa `maybeSingle()` para evitar falsos rebotes por consultas de perfil y muestra un estado útil en caso de error de datos, sin cerrar la sesión.
- Se eliminó el componente duplicado `components/affiliate-payout-profile.tsx`; `components/income-actions.tsx` es ahora la única implementación del bloque de métodos de cobro y retiros.
- El afiliado debe tener un método de cobro válido antes de poder solicitar retiro.
- La página muestra el estado financiero, método de cobro y destinos de retiros en un solo flujo.
