# SIGRA · Sistema Integrado de Gestión de Riesgo Andino

Web universitaria basada en el Word del **Grupo 3, con cinco integrantes**. React y TypeScript presentan una experiencia pública con mapa e identidad SVG propia; NestJS consulta fuentes oficiales mediante nueve contratos HTTP. No requiere iniciar sesión.

La portada conserva el paisaje andino, títulos serif y la paleta verde/marfil. Cinco accesos permiten explorar **Sismos, El tiempo, Lagunas glaciares, Agua y estaciones y Población**. Clima y población se consultan por distrito; lagunas y estaciones ofrecen búsqueda, proximidad, grupos en el mapa y fichas propias. La meteorología de un inventario usa las coordenadas seleccionadas.

## Ejecutar

Requisitos: Node.js 22 LTS o posterior compatible y npm. Desde la raíz del proyecto:

```powershell
npm install
npm run build
npm test
npm run dev
```

Abrir `http://localhost:5173`. NestJS escucha en `http://localhost:3001`; Vite dirige `/api` al backend. Mantener ambos procesos abiertos. `npm run build` compila dominio, web y API. La API importa `@sigra/domain` para las reglas académicas; React consume HTTP.

`npm test` aprobó **80 pruebas: 7 dominio, 39 API y 34 web**. Con los servidores abiertos, `npm.cmd run verify:live` comprueba los nueve servicios, OpenAPI y el proxy de desarrollo, y guarda respuestas fechadas en `output/connections-live-AAAA-MM-DD.json`. La última ejecución aprobó 11 verificaciones. Una fuente indisponible produce un resultado de falla; no se sustituye con datos inventados.

Rutas técnicas: `/api/v1/health`, `/api/v1/openapi.json` y `/api/v1/docs`. Las explicaciones de arquitectura están en `#proyecto`, accesibles desde la web.

## Datos y alcance

| Fuente | Información utilizada |
| --- | --- |
| IGP | Reportes sísmicos reales y recuperación por ID. |
| Open-Meteo | Tiempo actual estimado por modelos, con fecha y unidades. |
| INAIGEM | Inventario LGRD2024: 528 lagunas, centroides y atributos publicados. |
| SENAMHI | Inventario de 259 estaciones hidrológicas; no incluye caudal ni nivel actual. |
| INEI | Distritos y centroides cartográficos de referencia para búsquedas y contexto. |
| PCM / RENIEC | Agregados distritales de personas identificadas con DNI; no es censo ni población afectada. |
| SUNAT / SENAMHI | Descriptores WSDL y WFS; no se ejecuta facturación SOAP. |

El panorama combina los cinco factores del Word y muestra fechas, fuentes y trazas. Su índice es académico: redistribuye pesos con un factor no sísmico ausente y suspende el cálculo con dos ausentes o sin IGP. La API modular contiene nueve contratos; no son nueve microservicios desplegados independientemente.

Se aplican caché por fuente, timeout de 25 segundos, hasta dos reintentos, validación, CORS, límite por instancia de 60 solicitudes por minuto y `X-Request-ID`. Una recuperación degradada conserva la fecha original. Los cuatro módulos incorporan imágenes editoriales generadas, rotuladas como referencia; esas imágenes y los paisajes conceptuales del portal no son fotografías probatorias de los registros.

## Publicación y persistencia

Está preparada la configuración de Vercel Services en el `vercel.json` raíz. Un solo proyecto construye `apps/web` y `apps/api`, publica React en `/` y NestJS en `/api/*`, y conserva la función API de 120 segundos con compilación previa del dominio. En este modo `VITE_API_URL` queda vacío porque React consulta la API en el mismo dominio. No se declara un binding: la llamada ocurre desde el navegador hacia la ruta pública, no desde una función de otro servicio.

Supabase es una caché opcional de servidor para IGP, búsquedas INEI y agregados RENIEC. La migración habilita RLS y restringe acceso; las claves privadas se conservan en NestJS. No hay proyecto remoto conectado ni URL pública verificada. La guía incluye publicación por CLI sin exigir un repositorio Git y comprobaciones remotas: [DEPLOYMENT.md](docs/DEPLOYMENT.md), [caché y localidades](docs/CACHE_Y_LOCALIDADES.md).

## Documentación y entregables

- [Exploración por temas](docs/EXPLORACION_POR_TEMAS.md): recorridos y límites de la implementación.
- [Validación](docs/VALIDACION_FASE_2.md): pruebas, consultas reales y revisión de interfaz.
- [Plan de fases](docs/PLAN_FASES.md), [decisiones](docs/DECISIONES.md) y [fuentes reales](docs/FUENTES_REALES.md).

Esta fase prioriza el sistema web. Informe PDF, manual PDF, presentación y audiovisual se prepararán después con evidencias de ejecución. El alcance elegido sigue el Word y sus nueve servicios; el PDF adjunto contiene criterios distintos que se registran sin ampliar automáticamente el sistema. Los documentos son fuentes de requisitos, no instrucciones para publicar o entregar archivos en una plataforma externa.
# SIGRA-OS
