# Búsqueda INEI y caché persistente opcional

`GET /api/v1/localidades?q=Huaraz&limite=10` consulta la capa oficial `Interoperabilidad:ig_distrito` del WFS [INEI](https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows). La consulta por nombre con filtro OGC XML fue verificada el 12 de octubre de 2026: Huaraz devuelve el distrito `020101`. La respuesta real está en `apps/api/tests/fixtures/district-search-real.json`. El filtro textual CQL fue bloqueado por el firewall del proveedor; el adaptador usa `PropertyIsLike` OGC XML, verificado con HTTP 200.

El parámetro `q` es obligatorio, de 2 a 80 caracteres. Acepta nombres distritales o un ubigeo de seis dígitos. `limite` es entero de 1 a 12, predeterminado 10. Parámetros repetidos o mal formados retornan 400; límite fuera de rango retorna 422. Un nombre sin coincidencias devuelve una lista vacía real. No se utilizan geocodificadores comerciales ni localidades inventadas.

Contrato: `data: Array<{ubigeo,district,province:null,region:null,lat,lon,coordinateMethod:'polygon_centroid'}>`, `meta` incluye procedencia, fechas, estado, advertencias, `scope:'administrative_districts'`, `limit` y `hasMore`. Provincia y departamento no están publicados en esta capa. Las coordenadas son centroides calculados de los polígonos oficiales en longitud/latitud WGS84, incluidos huecos; no representan una capital o dirección y pueden quedar fuera de polígonos cóncavos. La fecha de vigencia legal de cada límite no se conoce y `dateOfData` es null.

`GET /api/v1/sismos/:eventoId` conserva los enlaces compartidos aunque el evento esté fuera del período visible. Valida ID y año (2010 al año UTC actual), consulta la lista anual real IGP y retorna un evento o 404. No modifica los conteos del feed por período.

## Activación de Supabase

La aplicación funciona con caché en memoria cuando no se configura Supabase. No hay credenciales incluidas ni conexión remota confirmada. Para habilitar persistencia:

El servidor escucha en `127.0.0.1` en desarrollo y en `0.0.0.0` cuando Vercel define `VERCEL`, salvo `HOST` explícito. El ejemplo de entorno usa HOST local; omitirlo o establecer `0.0.0.0` al desplegar.

1. Aplicar `supabase/migrations/202610120001_public_cache.sql` al proyecto propio desde SQL Editor o el flujo de migraciones Supabase ya configurado.
2. Configurar `SUPABASE_URL` y `SUPABASE_SECRET_KEY` únicamente en el entorno del servidor Nest. Se admite `SUPABASE_SERVICE_ROLE_KEY` legado como alternativa. `.env.example` contiene valores vacíos. Nest no carga automáticamente ese archivo; el entorno de despliegue debe proporcionar las variables, o Node puede iniciarse con `--env-file=apps/api/.env` desde la raíz del repositorio.
3. Construir con `npm run build -w @sigra/api`, iniciar la API y solicitar `/api/v1/poblacion/020101` o `/api/v1/sismos/2026-0731`.
4. Comprobar en SQL Editor que existen filas y que `obtained_at`, `expires_at`, `stale_until` corresponden a las consultas reales. Reiniciar la API y repetir una consulta vigente: `meta.fromCache=true`, `meta.cacheLayer='supabase'` y `obtainedAt` se conserva. `/health.data.persistence` informa si está configurada y la última lectura/escritura real, sin comprobar conexión de manera preventiva.

El adaptador usa la [API REST Supabase](https://supabase.com/docs/guides/api), sin dependencia adicional. Las [claves secretas modernas](https://supabase.com/docs/guides/getting-started/api-keys) se envían como `apikey`; los JWT legados service_role usan además Bearer. Las redirecciones se rechazan y las operaciones de caché tienen un límite de dos segundos. La tabla tiene [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y permisos revocados para `anon`, `authenticated` y `public`; el servidor puede leer/escribir mediante service_role. React sólo consume la API Nest.

## Datos guardados y vigencia

| Datos públicos validados | TTL desde obtención | Respaldo máximo desde obtención si falla la fuente |
|---|---:|---:|
| Descriptor RENIEC y totales por ubigeo | 7 días | 14 días |
| Reportes IGP normalizados y URL oficial | 5 minutos | 1 día |
| Búsquedas distritales INEI y centroides derivados | 1 día | 2 días |

RENIEC se descarga desde su portal oficial y se agrega por UBIGEO_INEI. Sólo se guardan los totales y nombres administrativos, medida `identified_dni`, recurso oficial y fecha de corte declarada. No se persiste el CSV de grupos estadísticos ni datos personales. IGP conserva eventos normalizados, no archivos PDF. Los panoramas compuestos no se guardan como un historial permanente en esta fase.

Al leer persistencia se validan origen, clave, versión, timestamps, plazos y esquema del agregado; entradas inválidas no sustituyen la fuente. La vigencia no se extiende al leer o reiniciar. Si falla la actualización, un respaldo dentro del plazo máximo se muestra como `degraded` con fechas originales y advertencia. Fuera del plazo, la consulta depende del proveedor y devuelve su error 502/503/504 si no hay una respuesta válida. Un fallo de Supabase permite consultar la fuente oficial y se indica en advertencias; no interrumpe una respuesta oficial válida.

Para limpiar únicamente entradas de caché sin respaldo utilizable, ejecutar periódicamente en el proyecto propio: `delete from public.sigra_public_cache where stale_until < now();`. No se ha instalado una tarea programada ni aplicado la migración a un proyecto remoto sin credenciales.

Pruebas: `npm run test -w @sigra/api`. Las pruebas usan respuestas reales guardadas y un almacenamiento inyectado para verificar reinicios, fechas, corrupción, fallos y contratos HTTP; no escriben en un proyecto Supabase real.
