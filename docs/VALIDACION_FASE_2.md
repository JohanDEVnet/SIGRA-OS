# Conexiones y diseño — 12 de octubre de 2026

Este registro actualiza la fase 1. El alcance sigue el Word del Grupo 3 con cinco integrantes y la elección del usuario de React, NestJS y TypeScript. Las consultas se realizaron localmente; no acreditan un despliegue público ni garantizan disponibilidad futura de los proveedores.

Este documento conserva las comprobaciones sucesivas. El estado vigente de la exploración por temas y los conteos de pruebas aparecen en la última sección; las cifras de pruebas y diseños de secciones anteriores corresponden a sus momentos de revisión.

## Verificación reproducible

Compilación raíz aprobada: dominio, web y API. Vite genera el archivo principal de 422.86 kB y un archivo Hairline diferido de 125.69 kB, antes de gzip. Las 36 pruebas aprobadas (7 de dominio y 29 de API) cubren normalización, CSV por ubigeo, geometría distrital, contratos XML, timeout/caché, entradas, seguridad HTTP y composición completa/parcial/sin índice. Las entradas controladas de tests no se usan como respaldo de la web.

## Consultas reales

Evidencia guardada en `output/live-validation-2026-10-12.json`, con respuestas, URLs y fechas. La composición se consultó a las 10:21 de Lima.

| Capacidad | Evidencia |
| --- | --- |
| Sismos IGP | La web recibió 15 reportes en siete días; el más reciente era 2026-0732, M 4.3, del 12 de octubre a las 04:57 de Perú. |
| SENAMHI | Inventario real de 259 estaciones, sin caudal ni nivel actual. |
| INAIGEM | Inventario LGRD2024 de 528 lagunas, con centroides publicados. |
| PCM / RENIEC | Recurso oficial del segundo trimestre de 2026; 1,892 distritos agregados usando UBIGEO_INEI y grupos distintos de tipo de DNI, sexo y edad. |
| INEI | Epicentro de 2026-0731 contenido en el distrito Coracora, ubigeo 050701. Para 2026-0732 en el mar, distrito de referencia San Vicente de Cañete, a 36.1 km de su límite. |
| Open-Meteo | Condiciones estimadas actuales para las coordenadas del evento; fecha y unidades explícitas. |
| Catálogo propio | Nueve contratos SIG-01 a SIG-09 recibidos por React a través de la API. |
| SOAP SUNAT | WSDL público, cinco operaciones declaradas. No se invocó facturación ni se descargaron imports. |
| WFS SENAMHI | GetCapabilities 2.0.0, 11 operaciones declaradas y 1,030 capas; incluye la capa de estaciones hidrológicas. El descriptor se recibió también desde la web. |
| OpenAPI | Documento 3.1.0 con rutas, parámetros, esquemas y errores. |

Panorama real del evento **2026-0731**: Coracora, Parinacochas, Ayacucho; 12,687 personas identificadas con DNI; trimestre de referencia cerrado el 30 de junio de 2026; radio de 10 km; cero lagunas y cero estaciones dentro del radio; índice académico **20.2, Bajo**, con cinco factores completos. La consulta fría tardó 11.7 s. Cero corresponde a inventarios consultados correctamente, no a una sustitución de fallas.

La población identificada con DNI no equivale a censo ni a personas afectadas. Su fecha se deriva del trimestre declarado en el nombre del recurso, pues el CSV no aporta una columna individual de corte. El índice y las proximidades son académicos; las clasificaciones de inventario no se convierten en alertas actuales.

## Revisión de la web pública

Se revisaron escritorio (1440 × 1000) y móvil (390 × 844): ilustración Hairline, iconos propios, tarjetas de fuentes y contexto distrital real. La figura se carga al acercarse a la sección; se presenta como conceptual y conserva el mapa real como consulta principal. Las notas extensas y la información técnica se abren a petición del visitante. En móvil no se observó desbordamiento horizontal.

Capturas: `output/screenshots/hairline-desktop.png` y `output/screenshots/hairline-mobile.png`. La integración utiliza Terrain del paquete oficial; una figura Hairline personalizada depende de elegir el concepto consultado al usuario.

## Trabajo posterior

Vercel y Supabase todavía no están configurados ni verificados. La API es modular en un proceso, con nueve contratos; no son nueve despliegues independientes. Informe PDF, manual PDF, presentación y audiovisual se prepararán en la fase de entregables. La documentación local está actualizada, pero no se afirma conformidad académica total ni carga a la plataforma de la universidad.

## Cierre de conexiones — 10:37 de Lima

La comprobación `npm.cmd run verify:live` aprobó **11 verificaciones**: los nueve servicios, OpenAPI 3.1 y el recorrido web–API mediante el proxy. Evidencia actual en `output/connections-live-2026-10-12.json`. Cada respuesta conserva fuente, fecha y uso de caché real; el resultado de caché no se presenta como una nueva consulta externa.

Para el evento 2026-0732, el panorama completo devuelve distrito de referencia San Vicente de Cañete (ubigeo 150501), 63,404 personas identificadas con DNI al cierre del trimestre del 30 de junio, radio de 10 km, cero estaciones/lagunas en ese radio e índice académico 29.8, Moderado. El epicentro está en el mar: se explicita que el distrito está a 36.1 km de su límite y no se afirma pertenencia ni población afectada.

La web muestra estados y fechas reales en el catálogo. Los resúmenes SOAP/WFS presentan operaciones y capas declaradas; el JSON queda dentro de un control opcional. Se verificó desde React el descriptor SOAP (5 operaciones) y WFS (11 operaciones, 1,030 capas). La espera de las consultas individuales pasó a 90 s para admitir los reintentos de 25 s del servidor. Las 36 pruebas pasaron nuevamente con comprobaciones de cambios de estado tras éxito, recuperación degradada y fallo.

Capturas añadidas: `output/screenshots/connections-panorama-desktop.png`, `connections-catalog-desktop.png` y `connections-descriptors-mobile.png`. La revisión móvil mantuvo el documento sin desbordamiento horizontal. La compilación final de React/Vite fue correcta.

## Rediseño público — 12 de octubre

Se retiró «Cómo se conecta» y el texto decorativo/explicativo repetido. Los nueve contratos permanecen en la API. La presentación usa azul, celeste y coral, títulos sans serif y dos paisajes conceptuales nuevos. El último reporte tiene prioridad en móvil, con fecha oficial del IGP y estado de actualización.

La web revisa el feed cada minuto mientras está visible y no haya una consulta en curso. El backend conserva el TTL IGP de cinco minutos. Clima y panorama se refrescan también; el panorama completa una consulta lenta antes de procesar un refresh pendiente. Si una actualización falla, se identifica la consulta anterior y su periodo; el estado degradado no muestra «En vivo» activo.

Compilación React/Vite aprobada (412.44 kB antes de gzip). Las 11 comprobaciones en vivo de servicios, OpenAPI y proxy web–API volvieron a pasar. Se probaron manualmente filtros propios con teclado y ratón, periodo/magnitud, resultado vacío, menú móvil, capa real de lagunas, selección de epicentro y regreso a vista Perú. No se usaron respuestas inventadas en la página.

Revisión visual en 1440×1000, 390×844 y 360×800: ambas imágenes cargaron; no hay selectores nativos ni desbordamiento horizontal; los textos retirados no aparecen en el cuerpo de la web. Capturas: `output/screenshots/redesign-desktop.png`, `redesign-mobile.png` y `redesign-map-desktop.png`. Prompts y recursos guardados en `IDENTIDAD_VISUAL.md`.

Restauración solicitada el 12 de octubre de 2026: diseño anterior recuperado desde output/design-backup, conservando APIs y actualización automática. Build web correcto. Captura: output/screenshots/restored-previous-design.png.

Imágenes adicionales: Andes y costa después de los reportes, con carga diferida y proporciones reservadas. Build web correcto; ambas imágenes cargaron en navegador. A 390 px se apilan y no producen desbordamiento horizontal. Captura: output/screenshots/landscapes-desktop.png.


## Experiencia pública y preparación de publicación — 12/10/2026

Implementado: búsqueda de distritos oficiales INEI, geolocalización bajo acción del usuario, proximidad de100/300/500km, clusters por fuente/zoom, filtros propios por teclado, preferencias locales (no se guarda posición del dispositivo), compartir/copiar enlace y recuperación de un reporte por ID exacto. La explicación técnica y Hairline están en #proyecto, fuera de la página pública. Se conserva el diseño panorámico verde/marfil con imágenes de Andes y costa.

Build completo correcto y último build web correcto. Pruebas:7 dominio +39 API +5 experiencia pública =51 aprobadas. verify:live:11 aprobadas,0 fallos; evidencia output/connections-live-2026-10-12.json.

Navegador: Huaraz020101, centroide INEI−9.5704162183,−77.4715369560;100km sin reportes en7d y300km con2 reportes reales; radio/distrito se conservan al recargar. Búsqueda y filtros con teclado, copiar enlace, reporte2026-0001 de01/01/2026 recuperado fuera90d sin sumarlo a291 reportes del feed; abrir ese enlace no sobrescribe el distrito recordado. A390×844 el documento375px no desborda y los filtros se apilan en una columna; cero selects nativos. La geolocalización real del usuario no fue solicitada durante QA.

Capturas: output/screenshots/public-experience-desktop.png y public-experience-mobile.png.

Supabase: adaptador REST, codecs validados, migración RLS y env server-only implementados; pruebas con almacenamiento/HTTP inyectados. Health real indica configured:false,status:disabled. No equivale a conexión remota verificada ni a historial permanente de panoramas. Vercel tiene configs para los dos proyectos, ignore de archivos de trabajo y guía de despliegue; Vercel dashboard muestra login. Integraciones Vercel/Supabase encontradas pero no instaladas/conectadas al verificar. Falta acceso del usuario para publicar y probar URLs públicas.

## Exploración por temas — 12 de octubre, 15:42 de Lima

Se implementaron cinco accesos: Sismos, El tiempo, Lagunas glaciares, Agua y estaciones y Población. Se conserva el hero panorámico verde/marfil. El tiempo permite búsqueda distrital y consulta cercana sin elegir un sismo; población requiere seleccionar un distrito con ubigeo. Lagunas y estaciones ofrecen búsqueda por nombre, código o región, proximidad de 100/300/500 km, listas, clusters y ficha del elemento seleccionado. La meteorología adjunta consulta las coordenadas reales de ese elemento.

La compilación web aprobó. El conjunto vigente de pruebas aprobó **80: 7 dominio, 39 API y 34 web**. La comprobación local de conexiones aprobó **11 verificaciones**; `output/connections-live-2026-10-12.json` registra `checkedAt: 2026-10-12T20:41:52.451Z`, aproximadamente 15:42 de Lima. Esta evidencia corresponde a API local y proxy Vite, no a URLs de producción.

| Recorrido manual / fuente real | Resultado verificado |
| --- | --- |
| El tiempo · Huaraz | Búsqueda y selección mediante teclado; consulta Open-Meteo independiente de sismos. |
| Lagunas · Palcacocha | Selección desde el mapa; código `1376962_7`, área registrada `0.462 km²`, cordillera Blanca, distrito Independencia. |
| Agua · Ocoña | Selección desde la lista; código `204504`, altitud registrada `23 m`. |
| Población · Huaraz | Distrito seleccionado explícitamente: 70,074 personas identificadas con DNI, ubigeo `020101`, referencia `2026-06-30`. |
| Inventarios | 528 lagunas INAIGEM LGRD2024 y 259 estaciones hidrológicas SENAMHI. |

Las fichas muestran los atributos existentes del inventario, su procedencia y sus límites. Las ilustraciones SVG propias están identificadas como referencia general; no hay fotografías verificadas de cada elemento. No se publican niveles o caudales actuales ni mediciones actuales del glaciar. La cifra RENIEC mantiene su interpretación de personas identificadas con DNI.

La revisión móvil de los nuevos recorridos terminó en **390 × 844**: búsqueda meteorológica de Huaraz por teclado, consulta explícita de población, selección de Ocoña desde la lista y Palcacocha desde el mapa. En la consulta meteorológica de QA se recibieron `15.2 °C`, `0.1 mm` y `1.3 km/h`; son valores del modelo en ese momento, no cifras fijas de la aplicación.

En los cuatro temas móviles, `clientWidth=scrollWidth=375 px`, con espacio de barra vertical y sin desbordamiento horizontal. El mapa tiene 320 px de alto y no hay selectores nativos. En escritorio de 1440 px, la navegación usa cinco columnas, `clientWidth=scrollWidth=1425 px`, el mapa mide 480 px de alto y el marcador seleccionado mide 18 px.

También se verificó una búsqueda `ZZZZ` sin coincidencias, que limpia la ficha seleccionada, y el botón Atrás del navegador, que restaura el tema correcto. Capturas: `output/screenshots/themes-lagoon-desktop.png` y `output/screenshots/themes-weather-mobile.png`. No se solicitó geolocalización real del dispositivo durante estas pruebas.

La compilación web final también aprobó: JavaScript principal de 463.04 kB (139.20 kB gzip) y CSS de 84.75 kB (21.09 kB gzip). La ficha Palcacocha recibió meteorología real para sus coordenadas: `7.7 °C`, `0.1 mm` y `6.7 km/h`, con fecha del modelo 15:30 de Perú y consulta 15:43. Al volver a Sismos se mostraron el encabezado y la referencia Lima. El registro de consola del navegador no mostró mensajes con nivel `error` durante el cierre de QA.

Vercel y Supabase remoto permanecen pendientes de acceso de cuenta y validación real. Están preparados los archivos de configuración y la integración opcional; las pruebas inyectadas no prueban una conexión a Supabase remoto. La API conserva nueve contratos dentro de un proceso modular.

## Imágenes editoriales de los módulos — 12 de octubre

Se incorporaron cuatro WebP generados con la herramienta integrada: `lagoon-editorial-v1.webp`, `hydrology-editorial-v1.webp`, `weather-editorial-v1.webp` y `population-editorial-v1.webp`, en `apps/web/public`. Todos tienen 960 × 640 píxeles y calidad 86; sus tamaños son 209,554, 231,568, 149,414 y 180,026 bytes, respectivamente. Los PNG originales se conservan en `output/imagegen/modules-v1/`; los prompts y metadatos están en `docs/IMAGENES_MODULOS.md`.

`ThemeExplorer` usa estos recursos en los cuatro temas con la leyenda «Imagen generada de referencia». Sustituyen las referencias SVG en las vistas públicas, conservando los archivos anteriores. No son fotografías verificadas del lugar seleccionado. La meteorología contextual de inventarios conserva su ficha sin duplicar la imagen de El tiempo. Las APIs y las cifras oficiales no cambian.

La compilación web posterior a copiar los recursos aprobó: JavaScript principal de **463.45 kB** (139.40 kB gzip) y CSS de **85.10 kB** (21.16 kB gzip). La revisión en navegador confirmó las cuatro imágenes cargadas con `naturalWidth=960`, tanto en escritorio de 1440 px como en móvil de 390 × 844. En escritorio `clientWidth=scrollWidth=1425 px`; en móvil `clientWidth=scrollWidth=375 px` y las portadas miden aproximadamente 225.06 px de alto. No se observó desbordamiento horizontal.

La ficha Palcacocha conserva los atributos reales con la nueva portada: código `1376962_7`, área `0.462 km²`, cordillera Blanca y distrito Independencia. Los registros del navegador no mostraron mensajes de nivel `error`. Capturas: `output/screenshots/editorial-lagoon-desktop.png` y `output/screenshots/editorial-population-mobile.png`.

Las 80 pruebas anteriores no se repitieron para esta incorporación de imágenes; la evidencia específica del cambio es la compilación y la revisión visual descritas. No se acredita despliegue remoto.
