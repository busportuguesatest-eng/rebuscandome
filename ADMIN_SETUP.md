# Rebuscándome — Administrador único

El acceso administrativo no tiene registro público. Solo existe un administrador y el rol `admin` está protegido por una restricción única en PostgreSQL.

## Crear el administrador una sola vez

1. En Supabase abre **Project Settings → API** y localiza la **Secret key** (`sb_secret_...`). No la envíes por chat ni la pongas en archivos públicos.
2. En el `.env.local` del proyecto agrega temporalmente:

```env
SUPABASE_SECRET_KEY=sb_secret_...
```

3. Ejecuta en la carpeta del proyecto:

```bash
npm run admin:setup
```

4. El asistente pedirá correo, contraseña y nombre. La contraseña no se escribe dentro del código.
5. El script crea/auto-confirma el usuario y lo convierte en el único administrador. Si ya existe uno, se detiene y no crea otro.
6. Puedes eliminar `SUPABASE_SECRET_KEY` del `.env.local` después de completar el proceso.

Supabase indica que la Admin API y las claves secretas deben usarse únicamente en un entorno de confianza y nunca en el navegador.
