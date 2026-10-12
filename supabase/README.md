# Base de datos de SIGRA

SIGRA usa Supabase como caché persistente de datos públicos obtenidos de fuentes oficiales. La web no se conecta directamente a la base de datos y los visitantes no necesitan iniciar sesión.

## 1. Crear la tabla

1. Crear o abrir un proyecto en <https://supabase.com/dashboard>.
2. Entrar a **SQL Editor** y seleccionar **New query**.
3. Copiar todo el contenido de `migrations/202610120001_public_cache.sql`.
4. Ejecutar la consulta con **Run**.
5. Abrir **Table Editor** y comprobar que exista `public.sigra_public_cache`.

La migración habilita RLS, bloquea a los clientes públicos y permite acceso solamente al rol de servidor.

## 2. Obtener las credenciales

En el proyecto Supabase, abrir **Settings > API Keys**:

- `SUPABASE_URL`: aparece en **Project URL** o en el diálogo **Connect**. Tiene el formato `https://abcdefgh.supabase.co`.
- `SUPABASE_SECRET_KEY`: crear o copiar una clave **Secret**, con formato `sb_secret_...`. También se admite la clave heredada `service_role`, pero se recomienda Secret.

La clave Secret nunca debe colocarse en `apps/web`, en una variable `VITE_*`, en GitHub ni dentro de un documento. Se guarda únicamente como variable de entorno del proyecto API en Vercel.

## 3. Variables de Vercel

En el proyecto Vercel de la API, abrir **Settings > Environment Variables** y agregar:

```text
SUPABASE_URL=https://tu-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REEMPLAZAR_CON_LA_CLAVE_REAL
```

En Vercel Services, la web y la API comparten dominio. Dejar vacío:

```text
VITE_API_URL=
```

Después de modificar variables, volver a desplegar el proyecto. `CORS_ORIGINS` solo es necesario si además se autoriza un frontend alojado en otro origen.

## 4. Archivos locales

Los archivos `.env` reales están ignorados por Git. Para desarrollo se puede copiar `apps/api/.env.example` a `apps/api/.env` y `apps/web/.env.example` a `apps/web/.env.local`, reemplazando los ejemplos. No confirmar esos archivos en Git.

La migración crea la estructura local del proyecto. Crear el proyecto remoto y obtener sus credenciales requiere entrar a la cuenta de Supabase del propietario.
