# Despliegue de SIGRA: React, NestJS y Supabase

Estado al 12 de octubre de 2026: configuración preparada; publicación y conexión a un proyecto Supabase remoto pendientes de verificar. Las consultas públicas a IGP, SENAMHI, INAIGEM, Open-Meteo, INEI y PCM/RENIEC funcionan desde la API, independientemente de Supabase. Nunca se reemplazan fallas con registros inventados.

## Arquitectura de publicación

Crear un proyecto Vercel Services desde la raíz del monorepositorio. El `vercel.json` raíz define `web` para `apps/web` y `api` para `apps/api`. React recibe el tráfico de `/` y NestJS recibe `/api/*` conservando la ruta original, por ejemplo `/api/v1/health`. NestJS consulta las fuentes oficiales y puede guardar respuestas agregadas en Supabase. La web pública no requiere iniciar sesión.

Vercel reconoce `src/main.ts` como entrada NestJS y empaqueta la aplicación en una función. Esta configuración conserva los nueve servicios HTTP dentro de una API modular. El despliegue no convierte automáticamente los módulos en nueve procesos independientes. [Soporte oficial de NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

## Comprobación de accesos

La inspección local encontró Git, Node y npm. La CLI de Vercel puede ejecutarse mediante `npx`; no se detectaron variables de acceso Vercel/Supabase ni `access-token` de Supabase.

El workspace ya es un repositorio Git conectado a GitHub. Todavía no hay un proyecto `.vercel` enlazado ni `supabase/config.toml`. No se consultaron secretos ni se crearon proyectos remotos o despliegues desde esta revisión; el usuario puede tener una sesión activa en el navegador.

Para publicar hace falta una cuenta Vercel autenticada y seleccionar el equipo y proyecto correctos. Para activar persistencia hace falta un proyecto Supabase, ejecutar la migración y configurar su URL y clave de servidor.

## Configuración del proyecto Vercel Services

| Ajuste | Servicio Web | Servicio API |
| --- | --- | --- |
| Nombre | `web` | `api` |
| Root | `apps/web` | `apps/api` |
| Framework Preset | Vite | NestJS |
| Node.js | 22.x | 22.x |
| Install Command | `npm install --prefix ../..` | `npm ci --prefix ../..` |
| Build Command | `npm run build --prefix ../.. --workspace @sigra/web` | `npm run build --prefix ../.. --workspace @sigra/domain && npm run build --prefix ../.. --workspace @sigra/api` |
| Output Directory | `dist` | Conservar el valor del framework; no establecer `dist` como sitio estático |
| Configuración activa | `vercel.json` raíz | `vercel.json` raíz |

Los comandos con `--prefix ../..` permiten usar `package-lock.json`, npm workspaces y `packages/domain`. La API necesita compilar el dominio antes de resolver su entrada `dist/index.js`. React no importa ese paquete. [Vercel Services](https://vercel.com/docs/services), [configuración de servicios](https://vercel.com/docs/services/config-reference).

No hay bindings entre `web` y `api`. Vite produce archivos estáticos y el navegador llama públicamente a `/api/v1/...` en el mismo dominio. Los bindings solo están disponibles para código de servidor ejecutado en funciones; se añadirían si en el futuro otro backend llamara internamente a `api`. [Service bindings](https://vercel.com/docs/services/bindings).

La API utiliza Fluid compute y solicita `maxDuration: 120` para `src/main.ts`. Sus consultas individuales tienen un tiempo límite de 25 segundos y reintentos; la composición tiene un presupuesto de 85 segundos. Confirmar que el proyecto aplica los 120 segundos en el resumen de la función publicada. [Configuración de duración](https://vercel.com/docs/functions/configuring-functions/duration), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json).

## Variables por proyecto

Configurar valores en Vercel para Production y, si se van a probar, Preview. Cambiar una variable exige un despliegue nuevo.

| Variable | Proyecto | Valor / comportamiento |
| --- | --- | --- |
| `VITE_API_URL` | Web | Dejar vacío con Services para usar el mismo dominio y la ruta pública `/api/v1`. Solo definir si la API se despliega por separado. |
| `CORS_ORIGINS` | API | No es necesario para la web del mismo dominio. Usar únicamente para frontends adicionales alojados en otros orígenes. |
| `HOST` | API | `0.0.0.0` en Vercel. Localmente el valor por defecto es `127.0.0.1`. |
| `PORT` | API | Dejar sin definir en Vercel; usar el puerto proporcionado por el runtime. Localmente es `3001`. |
| `API_KEY` | API | Dejar sin definir para la web pública actual. Si se activa, los clientes deben enviar `X-API-Key`; React no envía una clave secreta. |
| `SUPABASE_URL` | API | URL del proyecto real, `https://<project-ref>.supabase.co`. Opcional hasta habilitar la caché persistente. |
| `SUPABASE_SECRET_KEY` | API | Clave de servidor `sb_secret_...`; sólo en la API. Alternativa heredada: `SUPABASE_SERVICE_ROLE_KEY`. |

`VITE_API_URL` se incorpora al JavaScript compilado. Cualquier variable `VITE_*` es pública; no colocar allí una clave Supabase de servidor, `API_KEY`, contraseña ni cadena Postgres. [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [claves Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Los `.env.example` no contienen credenciales. NestJS lee `process.env`; el arranque actual no carga automáticamente archivos `.env`. En desarrollo se pueden definir variables en PowerShell o pasar un archivo local con `node --env-file=apps/api/.env apps/api/dist/main.js` después de compilar. Vite sí lee su `.env.local` en `apps/web`.

## Publicar sin obligar a crear un repositorio Git

La CLI puede subir directamente este workspace. Mantener `package.json`, `package-lock.json`, `apps/` y `packages/` juntos; no subir solamente `apps/api`, porque depende del dominio. Git es una alternativa para despliegues automáticos, no un requisito para esta ruta.

Ejecutar estos comandos desde la **raíz de SIGRA**, una vez que se vaya a publicar. `npx` descarga la CLI sin añadirla a las dependencias del proyecto. NestJS requiere CLI 48.4.0 o posterior; comprobar la versión utilizada.

```powershell
npx --yes vercel@latest --version
npx --yes vercel@latest login
npx --yes vercel@latest whoami
npx --yes vercel@latest link
```

En `link`, seleccionar el equipo y el único proyecto **SIGRA Services**. La raíz del proyecto debe ser `./`, porque el `vercel.json` principal está en la raíz y contiene los dos servicios. El vínculo local queda en `.vercel`, ignorado por Git.

```powershell
npx --yes vercel@latest pull --environment=preview
npx --yes vercel@latest build
npx --yes vercel@latest deploy
```

Estas acciones producen un build y un preview con ambos servicios. Revisar primero la web, `/api/v1/health`, `/api/v1/openapi.json` y una consulta real. Después publicar el proyecto estable:

```powershell
npx --yes vercel@latest deploy --prod
```

No definir `VITE_API_URL`: el cliente ya usa `/api/v1/...` en el dominio compartido. No enviar `.vercel`, archivos `.env` ni tokens al repositorio público. [Vercel Services](https://vercel.com/docs/services), [guía oficial NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

En el Dashboard, importar el repositorio con Root Directory `./` y conservar el preset **Services** que aparece en la detección. El `vercel.json` raíz aporta los nombres, builds y rutas. Si Deployment Protection está activo en un preview, abrir la web y la API dentro del mismo despliegue autenticado.

## Supabase: persistencia opcional de datos públicos

La integración prevista usa la Data API REST de Supabase desde NestJS. No necesita una conexión Postgres directa ni una contraseña de base de datos en el navegador. Su objeto es conservar respuestas reales entre reinicios de la función, especialmente el dataset agregado de PCM/RENIEC y el catálogo de localidades.

1. Seleccionar un proyecto Supabase existente o crear el proyecto autorizado.
2. Ejecutar `supabase/migrations/202610120001_public_cache.sql` en el SQL Editor de ese proyecto, tras revisar su contenido. La migración crea `public.sigra_public_cache`, habilita RLS y restringe el acceso al servidor.
3. Copiar la URL y la clave secreta a las variables de entorno del proyecto Vercel Services. La API las usa en tiempo de ejecución; nunca ponerlas en variables `VITE_*`.
4. Volver a desplegar el proyecto y consultar datos reales para poblar la caché.
5. Verificar que aparece una fila con fechas de obtención y caducidad; forzar una nueva instancia o un redeploy y verificar que puede leerla. Las pruebas con HTTP inyectado no sustituyen esta comprobación remota.

La web no solicita login ni accede directamente a esa tabla. Las claves de servidor omiten RLS; se guardan sólo en NestJS. Para cualquier acceso futuro desde React, usar una clave publicable y políticas RLS específicas, sin permitir escritura anónima en la caché. [Claves y roles](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Consultar `docs/CACHE_Y_LOCALIDADES.md` para el contrato de persistencia, TTL y recuperación ante fallas. Registrar una prueba remota con la fecha, el proyecto utilizado y el resultado, omitiendo las claves. Configurar variables por sí solo no demuestra una conexión operativa.

Si en una fase posterior se decide usar SQL directo desde una función, Supabase recomienda el transaction pooler, sin prepared statements y con conexiones limitadas. Esa conexión no forma parte de la integración REST actual. [Conexiones Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Verificación después de publicar

Sustituir estos marcadores por URLs **obtenidas del despliegue**. Las URLs de ejemplo no son evidencia de publicación.

```powershell
$taskSigraOrigin = 'https://<dominio-sigra-real>'
Invoke-RestMethod "$taskSigraOrigin/api/v1/health"
Invoke-RestMethod "$taskSigraOrigin/api/v1/openapi.json" | Select-Object openapi
$taskEvents = Invoke-RestMethod "$taskSigraOrigin/api/v1/sismos?dias=7&mag_min=0"
$taskEvents.meta | Select-Object source,sourceUrl,obtainedAt,status,fromCache
Invoke-WebRequest $taskSigraOrigin | Select-Object StatusCode
```

En navegador, abrir la web publicada, filtrar un evento real, activar las capas de lagunas/estaciones y consultar el contexto, las localidades y los contratos. Verificar en Network que las peticiones permanecen en el mismo dominio bajo `/api/v1/` y reciben JSON. No considerar una respuesta HTML de la SPA como respuesta API.

Cuando una fuente falle, la interfaz debe mostrar la indisponibilidad o un resultado parcial con fechas y advertencias. Un HTTP 503/504 documentado puede demostrar el manejo de falla; no demuestra que esa fuente respondió correctamente. Guardar capturas y resultados fechados de las pruebas remotas.

`npm run verify:live` comprueba la API y el proxy de desarrollo de Vite. La comprobación del enrutamiento Services publicado se realiza además contra el dominio de preview y en el navegador.

## Límites actuales a considerar

La caché en memoria y el límite HTTP de 60 solicitudes por cliente/minuto pertenecen a cada instancia NestJS. Varias instancias Vercel no comparten esos contadores. Supabase conserva los datasets integrados por el adaptador persistente; no convierte todo el estado, trazas o control de solicitudes en almacenamiento distribuido. Para exposición con alta concurrencia, añadir un control compartido o una regla de infraestructura verificada.

El despliegue y las claves no garantizan disponibilidad de los proveedores externos. Conservar `obtainedAt`, `dateOfData`, estados y advertencias permite distinguir consultas recientes de inventarios históricos y respuestas recuperadas de caché.
