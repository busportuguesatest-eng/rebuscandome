# QA50 — Turnstile + Auth Recovery

Cambios incrementales sobre la versión maestra:

- Integra Cloudflare Turnstile en login y registro.
- Envía `captchaToken` a Supabase Auth.
- Protege recuperación de contraseña con Turnstile.
- Añade `/recuperar` para solicitar el enlace.
- Añade `/recuperar/nueva` para definir una nueva contraseña.
- La ruta `/auth/register` exige `captchaToken` y lo pasa a `signUp()`.
- Se añade `NEXT_PUBLIC_TURNSTILE_SITE_KEY` a `.env.example`.

No se modifica PagoFlash ni la lógica financiera.

## Producción

En Vercel debe existir:

`NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Site Key de Cloudflare>`

La Secret Key de Turnstile permanece en Supabase Auth > Bot and Abuse Protection.

Después de incorporar estos archivos al repositorio, hacer un nuevo Deploy en Vercel.
