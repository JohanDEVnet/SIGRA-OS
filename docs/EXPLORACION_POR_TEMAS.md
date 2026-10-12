# Exploración pública por temas — implementación

La solicitud del 12 de octubre de 2026 está implementada: clima, lagunas, estaciones hidrológicas y población pueden consultarse sin seleccionar un sismo. Se conserva el hero andino, la paleta verde/marfil, las imágenes de presentación y el acceso público sin login.

`ThemeExplorer` presenta cinco accesos con iconos SVG propios. `Themes.css` adapta sus vistas, mapas, fichas y listas a cada tema. Sismos conserva el mapa y los reportes IGP existentes; los demás temas tienen su propio estado de búsqueda y selección.

## Recorridos disponibles

| Tema | Interacción implementada | Datos y límites |
| --- | --- | --- |
| Sismos | Filtrar el feed, explorar grupos y puntos, seleccionar reporte y abrir su enlace | Magnitud, profundidad, fecha y epicentro IGP; contexto académico con fuentes y fechas. |
| El tiempo | Buscar un distrito INEI o consultar cerca del dispositivo bajo acción del usuario | Temperatura, precipitación y viento Open-Meteo en las coordenadas seleccionadas. Condiciones estimadas por modelos, con fecha y procedencia. |
| Lagunas glaciares | Buscar nombre, código o región; filtrar proximidad de 100/300/500 km; elegir desde lista o mapa | Inventario INAIGEM LGRD2024. Ficha con código, coordenadas y los campos publicados: región, distrito, cordillera y área. No mide el agua ni el glaciar actualmente. |
| Agua y estaciones | Buscar nombre, código o región; filtrar proximidad de 100/300/500 km; explorar grupos y seleccionar estación | Inventario hidrológico SENAMHI. Nombre, código, ubicación y altitud registrada cuando existe. No publica nivel, caudal ni confirmación de estado operativo actual. |
| Población | Buscar y seleccionar explícitamente un distrito; consultar y actualizar su agregado | Personas identificadas con DNI en el recurso PCM/RENIEC, ubigeo y referencia trimestral. No equivale a censo ni a personas afectadas. |

Los inventarios se ordenan por nombre o por distancia a la referencia elegida, muestran coincidencias reales y permiten ampliar la lista. Al seleccionar una laguna o estación, el mapa la enfoca y la ficha usa sus atributos oficiales. La meteorología adjunta consulta las coordenadas del elemento elegido.

Las búsquedas distritales devuelven centroides derivados de cartografía INEI. La interfaz los identifica como ubicaciones de referencia, no como direcciones o capitales. Población requiere un distrito con ubigeo; no asigna un registro distrital únicamente por la ubicación del dispositivo.

## Conexión y estados

El tiempo utiliza `/api/v1/meteorologia/actual?lat=...&lon=...`, sin construir un evento sísmico ficticio. Lagunas y estaciones utilizan sus endpoints de inventario; población obtiene el distrito mediante `/api/v1/localidades` y consulta `/api/v1/poblacion/:ubigeo`.

Cada vista conserva su fuente, fecha de obtención, fecha del modelo o referencia del inventario y advertencias. Los estados de carga y falla ofrecen reintento. Una consulta anterior de la misma ubicación conserva su fecha; cambiar de ubicación no muestra las cifras anteriores como si correspondieran al lugar nuevo. El tiempo revisa su consulta cada minuto mientras la página está visible, respetando la caché del backend.

## Recursos visuales

Los cuatro módulos incluyen imágenes editoriales generadas con la herramienta integrada, con una composición y tratamiento visual coherentes. La interfaz las rotula **«Imagen generada de referencia»**. No corresponden a una fotografía verificada del distrito, laguna o estación seleccionados ni muestran su estado actual.

| Módulo | Recurso en `apps/web/public` | Tamaño de archivo |
| --- | --- | ---: |
| Lagunas | `lagoon-editorial-v1.webp` | 209,554 bytes |
| Agua y estaciones | `hydrology-editorial-v1.webp` | 231,568 bytes |
| El tiempo | `weather-editorial-v1.webp` | 149,414 bytes |
| Población | `population-editorial-v1.webp` | 180,026 bytes |

Los WebP tienen 960 × 640 píxeles y calidad 86. Los PNG originales se conservan en `output/imagegen/modules-v1/`. Los SVG de referencia anteriores permanecen en los archivos del proyecto como recursos de la versión anterior; las vistas públicas usan las nuevas imágenes. Los prompts y metadatos se documentan en [IMAGENES_MODULOS.md](IMAGENES_MODULOS.md).

El tiempo tiene su imagen en la vista independiente. La lectura meteorológica adjunta a una laguna o estación conserva el contexto de esa ficha y no repite otra imagen meteorológica. Este cambio visual mantiene las consultas y atributos oficiales existentes.

Los paisajes Andes/costa del portal siguen siendo recursos conceptuales de presentación. No acreditan la situación de un sismo ni de un registro específico del inventario. La cartografía y los atributos oficiales constituyen la información consultable.

## Evidencia y límites

La revisión de escritorio confirmó el recorrido meteorológico de Huaraz con teclado, la selección de Palcacocha en el mapa, la selección de Ocoña desde la lista y la consulta explícita de población de Huaraz. El recurso consultado devuelve 70,074 personas identificadas con DNI para Huaraz, con referencia al 30 de junio de 2026.

Los inventarios consultados contienen 528 lagunas y 259 estaciones. La ficha Palcacocha muestra código `1376962_7`, área registrada de `0.462 km²`, cordillera Blanca y distrito Independencia. Ocoña muestra código `204504` y altitud registrada de `23 m`. Son atributos del inventario, no mediciones actuales.

Antes de incorporar las nuevas imágenes, la compilación web y 80 pruebas fueron aprobadas. La revisión en escritorio de 1440 px y móvil de 390 × 844 confirmó los recorridos, la selección de elementos y la navegación sin desbordamiento horizontal. La búsqueda sin coincidencias limpia la ficha seleccionada y el botón Atrás restaura el tema. Después de incorporar las imágenes, una nueva compilación y revisión visual confirmaron que los cuatro recursos cargan en escritorio y móvil sin desbordamiento; las pruebas anteriores no se repitieron para este cambio visual. El registro de evidencia se mantiene en [VALIDACION_FASE_2.md](VALIDACION_FASE_2.md).

La API conserva nueve contratos dentro de un proceso modular. La configuración Vercel y la caché opcional Supabase están preparadas, pero la publicación y la conexión a un proyecto remoto requieren acceso de cuenta y pruebas en las URLs reales. Ver [DEPLOYMENT.md](DEPLOYMENT.md).
