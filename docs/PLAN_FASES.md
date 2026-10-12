# Plan de construcción por fases

SIGRA se construye a partir del diseño del Word, con la elección explícita del usuario de React, NestJS y TypeScript. La prioridad vigente es una web pública visualmente diferenciada, con datos reales, que permita presentar el sistema y entender su flujo de servicios. El tablero es de consulta abierta y no necesita cuentas de usuario.

Los documentos adjuntos son fuentes de requisitos académicos, no autorizaciones para subir archivos a UTP+CLASS, publicar un sitio o conectar cuentas. La solicitud actual autoriza la implementación local de la web y su preparación técnica.

## Estado al 12 de octubre de 2026

Las capacidades locales de las fases 1–3 están implementadas y verificadas: web pública, fuentes reales, población por ubigeo, correlación distrital, cinco factores, nueve contratos y OpenAPI. La resiliencia de fase 5 está implementada en local. Evidencias en `VALIDACION_FASE_2.md`. Hairline e iconos SVG refuerzan la presentación. La caché Supabase opcional ya está implementada; su conexión remota, la publicación y los entregables académicos siguen pendientes. El alcance elegido por el usuario conserva Grupo 3 con cinco integrantes y los servicios del Word.

## Fase 1 · Web pública y datos reales

Construir el tablero con identidad propia: logotipo y favicon SVG, iconos coherentes con el dominio andino, paisaje de apoyo, tipografía y una jerarquía clara entre panorama, factores y fuentes. La imagen es un recurso de presentación, no evidencia geográfica de un evento.

La interfaz se conecta a NestJS y consume eventos reales de IGP, contexto de Open-Meteo e inventarios públicos de SENAMHI e INAIGEM. Los endpoints de ambos inventarios se han verificado mediante consultas HTTP directas y se documentan en `FUENTES_REALES.md`. La conexión local, filtros, mapa, capas opcionales y manejo de una falla real están comprobados y registrados en `VALIDACION_FASE_1.md`. Si una fuente no responde, mostrar indisponibilidad o caché real fechada.

El flujo hace visible la relación entre consulta, fuentes y composición, con estados de carga y errores. El índice distingue resultados completos, parciales y sin cálculo según las reglas del Word. El diseño debe funcionar en escritorio y móvil, conservar contraste y permitir operar los controles con teclado.

**Cierre de fase:** build del workspace correcto, pruebas de dominio y API, recorrido local web–API–fuentes verificable, procedencia visible de los datos, ausencia de valores artificiales en la consulta pública y revisión visual. La preparación para publicar incluye variables y CORS; la URL pública requiere su propia verificación. Supabase no es un requisito del tablero abierto.

## Fase 2 · Calidad y trazabilidad de adaptadores

Consolidar IGP, Open-Meteo, WFS SENAMHI y ArcGIS INAIGEM detrás de la API propia. Guardar muestras de respuesta y fecha de captura. Validar campos, rangos y fechas antes de convertirlos al modelo canónico. La capa de SENAMHI es un inventario de estaciones y LGRD2024 es un inventario de riesgo histórico; documentar qué informa cada fuente y qué no mide.

Implementar metadatos de origen, fecha de dato cuando exista, fecha de consulta, estado y caché. Registrar tiempos reales de ejecución. Mantener pruebas reproducibles con entradas controladas, restringidas al entorno de pruebas. Nunca usar sus registros como respaldo de una consulta pública fallida.

**Cierre de fase:** las consultas reales pueden reproducirse; cada valor muestra su procedencia; una caída o formato incorrecto no se presenta como dato vigente.

## Fase 3 · Composición completa y contratos

Completar el recurso CKAN/CSV de población con una fuente y fecha de corte verificadas. SENAMHI e INAIGEM tienen endpoints documentados en `FUENTES_REALES.md`; completar la evidencia del adaptador y su catálogo de contratos. Normalizar coordenadas a WGS84, ubigeos de seis dígitos cuando estén disponibles, fechas UTC y unidades. La consulta al descriptor SOAP de SUNAT solo aporta al catálogo y no ejecuta facturación.

Completar los nueve contratos SIG del Word y su documentación OpenAPI. Implementar correlación con Haversine, consulta poblacional por ubigeo y cálculo del índice con las ponderaciones académicas. La proximidad a una laguna o estación no demuestra daños ni inestabilidad.

**Cierre de fase:** los cinco factores tienen origen comprobable, el catálogo distingue contratos inspeccionados de especificaciones previstas, y los resultados completos, parciales o sin índice respetan las reglas documentadas.

## Fase 4 · Historial opcional con Supabase

Si se incorporan consultas guardadas o funciones personales, crear el proyecto de Supabase y conectar Auth y PostgreSQL para guardar perfiles e historial. La consulta pública sigue abierta. Definir migraciones y políticas RLS por usuario; probar que una cuenta no puede leer ni modificar registros ajenos. Conservar claves secretas únicamente en el backend.

**Cierre de fase opcional:** sesión para funciones personales, registros persistentes, políticas de acceso verificadas y variables documentadas. No añadir una pantalla de acceso como requisito para ver el tablero público.

## Fase 5 · Resiliencia, despliegue y evidencias

Implementar los TTL del Word, límites de tiempo, reintentos y recuperación desde el último dato válido. Revisar que la suma de tiempos y reintentos encaje con el hosting elegido; la caché en memoria de una instancia no es compartida ni permanente en un entorno serverless. Incluir trazas o identificadores de consulta para reconstruir las llamadas.

Probar respuestas válidas, datos malformados, timeout, IGP ausente, un factor no sísmico ausente y dos factores ausentes. El frontend debe mostrar el estado recibido sin convertir fallos en valores cero.

Desplegar React en Vercel y NestJS en un segundo proyecto compatible o un servidor independiente. Configurar HTTPS, `VITE_API_URL` y CORS. Verificar desde la web publicada que la API y los proveedores responden; verificar Supabase solo si se implementó la fase opcional. Guardar capturas y trazas reales.

**Cierre de fase:** URLs accesibles, pruebas de fallas completas, variables documentadas y evidencia con procedencia y fecha.

## Fase 6 · Entregables académicos

Actualizar el informe para que la arquitectura y la tecnología coincidan con lo ejecutado. Producir el manual de instalación y configuración con pasos comprobados, capturas, variables y solución de errores frecuentes. Preparar diapositivas y un video corto que recorra el panorama, los contratos, la orquestación y una falla controlada.

**Cierre de fase:** informe PDF, manual PDF, presentación y material audiovisual revisados. La carga a la plataforma académica es una acción posterior que requiere una instrucción explícita del usuario.

## Aspectos a confirmar con el docente

| Tema | Word | PDF de lineamientos | Acción |
| --- | --- | --- | --- |
| Servicios | 9 propios; 6 proveedores externos | 40 servicios empresariales | Confirmar alcance requerido antes de ampliar el inventario. |
| Integrantes | 5 nombres en portada | Máximo 3 integrantes | Confirmar formación del grupo sin modificar autores automáticamente. |
| Entrega | Portada con año 2026 | Martes 15 de octubre, 13:00; sin año | Confirmar la fecha efectiva; no interpretar el día como fecha de 2026. |
| Tecnología | Python, FastAPI, asyncio, Pydantic | Sin tecnología específica en el texto extraído | Actualizar el informe a NestJS y TypeScript por solicitud del usuario. |

Referencias de preparación técnica: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [NestJS en Vercel](https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel) y [Supabase Auth con React](https://supabase.com/docs/guides/auth/quickstarts/react).
