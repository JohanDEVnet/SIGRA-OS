# Validación de la web pública · Fase 1

**Registro histórico de la fase 1.** El estado vigente del 12 de octubre está en `VALIDACION_FASE_2.md`; las limitaciones de población, contratos y caché descritas aquí corresponden a la versión anterior.


Resultados técnicos registrados el **11 de octubre de 2026, hora de Lima**. La interfaz de esta fase consulta datos reales y ofrece acceso público sin login. Se retiraron la interfaz administrativa, el simulador de fuentes y los registros artificiales del recorrido de consulta.

## Compilación y pruebas automatizadas

`npm run build` aprobado: compila el paquete de dominio, React/Vite y la API NestJS con TypeScript. `npm test` aprobado: **13 pruebas**, cinco del dominio y ocho de la API. El dominio se conserva para reglas académicas y pruebas; React y NestJS no lo importan en el recorrido público.

Las cinco pruebas del dominio comprueban las reglas académicas del Word: ejemplo de índice **62.9**, redistribución de pesos, fuentes faltantes, reducción por profundidad y límites de puntajes. El valor 62.9 pertenece exclusivamente a una prueba de referencia; no es un resultado presentado al público.

Las ocho pruebas de API comprueban normalización de respuestas IGP y Open-Meteo, geometrías/centroides de inventarios, rechazo de conjuntos truncados, fechas y recuperación de caché real, validación de entradas y respuestas HTTP de fuentes no integradas. Utilizan fragmentos de respuestas reales e inyección de dependencias, por lo que son reproducibles sin red. Aprobar estas pruebas no acredita por sí solo que los proveedores estén disponibles.

## Consultas reales y conexión local

Se verificaron peticiones en vivo de los cuatro adaptadores desde la API local y la respuesta de eventos oficiales a través del proxy `/api` de Vite, con **HTTP 200**. El recorrido comprobado es web/Vite → NestJS → proveedor público.

| Fuente | Evidencia disponible | Límite del dato |
| --- | --- | --- |
| IGP | Respuesta real del endpoint de sismos, normalizada con fecha UTC y enlace de procedencia. | Información publicada por el proveedor; el catálogo varía con las nuevas publicaciones. |
| Open-Meteo | Respuesta actual de temperatura, precipitación y viento, con fecha y coordenadas de celda. | Estimaciones de modelos meteorológicos; no son una estación local observada. |
| SENAMHI | WFS oficial con **259 estaciones hidrológicas** en el lote verificado. | Inventario de ubicaciones; sin caudal, nivel de río o fecha individual de medición. |
| INAIGEM | LGRD2024 ArcGIS con **528 lagunas** y centroides WGS84. | Clasificación de inventario 2024; fecha de edición de dataset 2024-12-04, sin vigilancia actual. |

Las cantidades corresponden a la consulta de verificación, no a una constante universal. Los endpoints, campos y muestras de SENAMHI e INAIGEM están en `FUENTES_REALES.md` y `docs/sources`.

La API usa caché de cinco minutos y llamadas limitadas a doce segundos. Si el proveedor falla, solo puede entregar la última respuesta real de hasta 24 horas de antigüedad, conserva su fecha y marca `degraded`. Si no existe caché válida, responde indisponibilidad; no genera datos sustitutos.

## Funciones deliberadamente no disponibles

Población por ubigeo aún no está integrada. El panorama con índice y los contratos pendientes responden **HTTP 503** con «Fuente aún no integrada». La interfaz no presenta habitantes inventados ni calcula un índice con factores incompletos.

El backend es una API modular NestJS en un proceso. Las nueve entradas del catálogo representan contratos del diseño académico, no nueve microservicios desplegados por separado.

Supabase, historial personal, autenticación y despliegue público no se validan en esta fase. La web está preparada para consulta pública; una URL publicada en Vercel requiere comprobar por separado el hosting y CORS de la API.

## Revisión en navegador

En escritorio, a 1440 × 1000 px, se verificó la carga de **15 reportes IGP en la consulta de siete días**, las capas de 528 lagunas y 259 estaciones, y el contexto meteorológico de Open-Meteo para la ubicación inicial de Ayacucho (estimación de 0.7 °C al momento de la consulta). Se probaron el cambio del intervalo a 30 días, el filtro por Quilca con magnitud mínima 5 (un resultado M 5.1, ID `2026-0729`), su detalle correcto y la selección/focalización desde un marcador del mapa. Son resultados del momento de revisión; los datos pueden cambiar.

En móvil, a 390 × 844 px, se verificaron portada, apertura y cierre de menú, navegación al mapa y filtros en dos columnas. El contenido registró `clientWidth = scrollWidth = 375 px`, con 15 px reservados para la barra vertical; no hubo desbordamiento horizontal.

Una consulta a Open-Meteo para otra ubicación devolvió HTTP 503 durante la revisión. La interfaz mostró indisponibilidad y la opción de reintentar, sin insertar valores sustitutos. Esto aporta evidencia de manejo de una falla real además de las pruebas automatizadas.

| Comprobación | Estado |
| --- | --- |
| Navegador de escritorio, 1440 × 1000 px | Consulta, filtros, detalle y selección desde marcador verificados. |
| Navegador móvil, 390 × 844 px | Portada, menú, navegación al mapa y disposición de filtros verificados. |
| Mapa y capas opcionales con puntos reales | Activación de inventarios y focalización verificadas en escritorio. |
| Desbordamiento horizontal en móvil | No observado; ancho de contenido coincide con ancho desplazable. |
| Falla real de proveedor | Open-Meteo HTTP 503 mostrado con indisponibilidad y reintento. |

Las capturas de la interfaz vigente se guardan en `output/screenshots`: `public-home-mobile.png`, `public-home-desktop.png` y `public-map-desktop.png`. Las capturas anteriores de la interfaz inicial no acreditan la revisión de la web pública vigente.

Para reproducir la validación técnica, ejecutar `npm run build`, `npm test` y `npm run dev` desde la raíz. Después consultar `/api/v1/health`, `/api/v1/sismos`, `/api/v1/meteorologia/actual` con coordenadas válidas, `/api/v1/hidrologia/estaciones` y `/api/v1/glaciares/lagunas`; revisar los metadatos de procedencia y fecha de cada respuesta.
