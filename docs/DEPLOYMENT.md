# Despliegue de SIGRA: React, NestJS y Supabase

Estado al 12 de octubre de 2026: configuración preparada; publicación y conexión a un proyecto Supabase remoto pendientes de verificar. Las consultas públicas a IGP, SENAMHI, INAIGEM, Open-Meteo, INEI y PCM/RENIEC funcionan desde la API, independientemente de Supabase. Nunca se reemplazan fallas con registros inventados.

## Arquitectura de publicación

Crear dos proyectos Vercel con acceso al mismo monorepositorio: uno para `apps/web` y otro para `apps/api`. React sirve el mapa y consulta el origen HTTPS de NestJS. NestJS consulta las fuentes oficiales y puede guardar respuestas agregadas en Supabase. La web pública no requiere iniciar sesión.

Vercel reconoce `src/main.ts` como entrada NestJS y empaqueta la aplicación en una función. Esta configuración conserva los nueve servicios HTTP dentro de una API modular. El despliegue no convierte automáticamente los módulos en nueve procesos independientes. [Soporte oficial de NestJS](https://vercel.com/docs/frameworks/backend/nestjs).

## Comprobación de accesos

La inspección local encontró Git, Node y npm. No encontró las CLIs `vercel` y `supabase` en el PATH, variables de acceso Vercel/Supabase, archivos de autenticación Vercel en las ubicaciones estándar ni `access-token` de Supabase. La carpeta `.supabase` contiene telemetría y trazas; su existencia no demuestra autenticación.

El workspace no tiene `.git`, proyectos `.vercel` enlazados ni `supabase/config.toml`. No se consultaron secretos ni se crearon cuentas, proyectos remotos o despliegues. Estos resultados describen el acceso local disponible; no descartan que el usuario tenga una sesión en su navegador.

Para publicar hace falta una cuenta Vercel autenticada y seleccionar el equipo/proyectos correctos. Para activar persistencia hace falta un proyecto Supabase, ejecutar la migración y configurar su URL y clave de servidor.

## Configuración de los proyectos Vercel

| Ajuste | Web | API |
| --- | --- | --- |
| Root Directory | `apps/web` | `apps/api` |
| Framework Preset | Vite | NestJS |
| Node.js | 22.x | 22.x |
| Include source files outside Root Directory in the Build Step | Activado | Activado |
| Install Command | `npm install --prefix ../..` | `npm ci --prefix ../..` |
| Build Command | `npm run build --prefix ../.. --workspace @sigra/web` | `npm run build --prefix ../.. --workspace @sigra/domain && npm run build --prefix ../.. --workspace @sigra/api` |
| Output Directory | `dist` | Conservar el valor del framework; no establecer `dist` como sitio estático |
| Configuración versionada | `apps/web/vercel.json` | `apps/api/vercel.json` |

El acceso a archivos externos permite usar `package-lock.json`, npm workspaces y `packages/domain`. La API necesita compilar el dominio antes de resolver su entrada `dist/index.js`. React no importa ese paquete. [Monorepos](https://vercel.com/docs/monorepos), [acceso fuera del directorio raíz](https://vercel.com/docs/monorepos/monorepo-faq).

La API utiliza Fluid compute y solicita `maxDuration: 120` para `src/main.ts`. Sus consultas individuales tienen un tiempo límite de 25 segundos y reintentos; la composición tiene un presupuesto de 85 segundos. Confirmar que el proyecto aplica los 120 segundos en el resumen de la función publicada. [Configuración de duración](https://vercel.com/docs/functions/configuring-functions/duration), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json).

## Variables por proyecto

Configurar valores en Vercel para Production y, si se van a probar, Preview. Cambiar una variable exige un despliegue nuevo.

| Variable | Proyecto | Valor / comportamiento |
| --- | --- | --- |
| `VITE_API_URL` | Web | Origen HTTPS de la API, por ejemplo el dominio asignado por Vercel. Sin `/api/v1` y sin barra final. |
| `CORS_ORIGINS` | API | Orígenes HTTPS de las webs autorizadas, separados por comas. Sin rutas ni barra final. Añadir los orígenes exactos de los previews que se usarán. |
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

En `link`, seleccionar el equipo y el proyecto **API**; configurar su Root Directory como `apps/api` y los ajustes de la tabla. Puede usarse un proyecto existente o crear uno al publicar. No enlazar una carpeta de otra tarea. El vínculo local queda en `.vercel`, ignorado por Git.

```powershell
npx --yes vercel@latest pull --environment=preview
npx --yes vercel@latest build
npx --yes vercel@latest deploy
```

Estas acciones producen un build para Vercel y un preview. Revisar primero `/api/v1/health`, `/api/v1/openapi.json` y una consulta real. Después publicar la API estable:

```powershell
npx --yes vercel@latest deploy --prod
```

Copiar el origen real obtenido a `VITE_API_URL` del proyecto Web. Volver a ejecutar `link` desde la raíz para seleccionar el proyecto **Web**, con Root Directory `apps/web`. Ejecutar `pull`, `build` y `deploy` para su preview; añadir ese origen exacto a `CORS_ORIGINS` de la API y volver a desplegarla. Al verificar la web, ejecutar `deploy --prod` y añadir también su origen estable a CORS. [CLI para monorepos](https://vercel.com/docs/monorepos), [guía oficial NestJS](https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel).

Cada vez que se cambie entre Web y API, comprobar qué proyecto quedó enlazado. El estado y las variables descargados pertenecen al proyecto seleccionado. No enviar `.vercel`, archivos `.env` ni tokens a un repositorio público.

La alternativa mediante Dashboard consiste en importar un repositorio y crear los dos proyectos con los ajustes anteriores. Si Deployment Protection está activo en un preview, comprobar que las consultas desde el navegador tienen acceso a la API: CORS no elimina la autenticación de Vercel.

## Supabase: persistencia opcional de datos públicos

La integración prevista usa la Data API REST de Supabase desde NestJS. No necesita una conexión Postgres directa ni una contraseña de base de datos en el navegador. Su objeto es conservar respuestas reales entre reinicios de la función, especialmente el dataset agregado de PCM/RENIEC y el catálogo de localidades.

1. Seleccionar un proyecto Supabase existente o crear el proyecto autorizado.
2. Ejecutar `supabase/migrations/202610120001_public_cache.sql` en el SQL Editor de ese proyecto, tras revisar su contenido. La migración crea `public.sigra_public_cache`, habilita RLS y restringe el acceso al servidor.
3. Copiar la URL y la clave secreta al proyecto **API** de Vercel mediante sus variables de entorno.
4. Volver a desplegar la API y consultar datos reales para poblar la caché.
5. Verificar que aparece una fila con fechas de obtención y caducidad; forzar una nueva instancia o un redeploy y verificar que puede leerla. Las pruebas con HTTP inyectado no sustituyen esta comprobación remota.

La web no solicita login ni accede directamente a esa tabla. Las claves de servidor omiten RLS; se guardan sólo en NestJS. Para cualquier acceso futuro desde React, usar una clave publicable y políticas RLS específicas, sin permitir escritura anónima en la caché. [Claves y roles](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Consultar `docs/CACHE_Y_LOCALIDADES.md` para el contrato de persistencia, TTL y recuperación ante fallas. Registrar una prueba remota con la fecha, el proyecto utilizado y el resultado, omitiendo las claves. Configurar variables por sí solo no demuestra una conexión operativa.

Si en una fase posterior se decide usar SQL directo desde una función, Supabase recomienda el transaction pooler, sin prepared statements y con conexiones limitadas. Esa conexión no forma parte de la integración REST actual. [Conexiones Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Verificación después de publicar

Sustituir estos marcadores por URLs **obtenidas del despliegue**. Las URLs de ejemplo no son evidencia de publicación.

```powershell
$taskApiOrigin = 'https://<dominio-api-real>'
$taskWebOrigin = 'https://<dominio-web-real>'
Invoke-RestMethod "$taskApiOrigin/api/v1/health"
Invoke-RestMethod "$taskApiOrigin/api/v1/openapi.json" | Select-Object openapi
$taskEvents = Invoke-RestMethod "$taskApiOrigin/api/v1/sismos?dias=7&mag_min=0"
$taskEvents.meta | Select-Object source,sourceUrl,obtainedAt,status,fromCache
Invoke-WebRequest "$taskApiOrigin/api/v1/sismos?dias=7&mag_min=0" -Headers @{ Origin=$taskWebOrigin } | Select-Object StatusCode,Headers
```

Confirmar `Access-Control-Allow-Origin` con el origen Web autorizado. En navegador, abrir la web publicada, filtrar un evento real, activar las capas de lagunas/estaciones y consultar el contexto, las localidades y los contratos. Verificar en Network que las peticiones van al dominio correcto de la API y reciben JSON. No considerar una respuesta HTML de la SPA como respuesta API.

Cuando una fuente falle, la interfaz debe mostrar la indisponibilidad o un resultado parcial con fechas y advertencias. Un HTTP 503/504 documentado puede demostrar el manejo de falla; no demuestra que esa fuente respondió correctamente. Guardar capturas y resultados fechados de las pruebas remotas.

`npm run verify:live` comprueba la API y el proxy de desarrollo de Vite. Su comprobación final solicita `/api/v1/...` al origen Web; en producción la web actual consulta directamente `VITE_API_URL`. Por eso ese script no es una validación completa de producción. La comprobación de la conexión Web → API publicada se realiza en navegador.

## Límites actuales a considerar

La caché en memoria y el límite HTTP de 60 solicitudes por cliente/minuto pertenecen a cada instancia NestJS. Varias instancias Vercel no comparten esos contadores. Supabase conserva los datasets integrados por el adaptador persistente; no convierte todo el estado, trazas o control de solicitudes en almacenamiento distribuido. Para exposición con alta concurrencia, añadir un control compartido o una regla de infraestructura verificada.

El despliegue y las claves no garantizan disponibilidad de los proveedores externos. Conservar `obtainedAt`, `dateOfData`, estados y advertencias permite distinguir consultas recientes de inventarios históricos y respuestas recuperadas de caché.
