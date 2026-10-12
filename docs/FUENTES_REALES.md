# Fuentes públicas verificadas: SENAMHI e INAIGEM

Verificación mediante peticiones HTTP reales realizada el **11 de octubre de 2026, entre las 20:40 y las 20:45, hora de Lima** (12 de octubre, 01:40–01:45 UTC). Las respuestas se guardan en `docs/sources`. Una verificación puntual no garantiza la disponibilidad futura del proveedor.

El usuario ha cambiado la prioridad a una web pública con datos reales. Estos resultados permiten sustituir los inventarios simulados de estaciones y lagunas. Si una consulta falla, la aplicación debe mostrar la fuente no disponible o una copia real de caché con su fecha; no completar factores con registros artificiales.

## SENAMHI · Inventario de estaciones hidrológicas

**Estado verificado:** HTTP 200, GeoJSON `FeatureCollection`, `totalFeatures: 259`, 259 elementos recibidos con `count=500`. La capa se descubrió en un GetCapabilities real, con título `ESTACIONES HIDROLÓGICAS`.

Origen institucional: [catálogo WFS de IDESEP](https://idesep.senamhi.gob.pe/portalidesep/idesep_componente_catalogo_geoservicios_wfs.jsp). Servicio: `https://idesep.senamhi.gob.pe/geoserver/ows`.

```text
GET /geoserver/ows
  ?service=WFS
  &version=2.0.0
  &request=GetFeature
  &typeNames=g_99_01:99_01_002_03_001_000_0000_00_00
  &outputFormat=application/json
  &srsName=EPSG:4326
  &count=500
  &startIndex=0
```

[Abrir la consulta real de estaciones](https://idesep.senamhi.gob.pe/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=g_99_01:99_01_002_03_001_000_0000_00_00&outputFormat=application/json&srsName=EPSG:4326&count=500&startIndex=0).

| Campo de origen | Uso en SIGRA |
| --- | --- |
| `features[].id` | Identificador de la entidad WFS. |
| `properties.codigo`, `cod_base` | Código de estación como texto. |
| `properties.estacion` | Nombre de estación. |
| `geometry.coordinates` | Punto WGS84 en orden `[longitud, latitud]`. |
| `properties.latitud`, `longitud` | Coordenadas numéricas alternativas; validar rangos. |
| `departamento`, `provincia`, `distrito` | Ubicación administrativa textual. |
| `altitud` | Valor numérico del inventario; conservar la unidad de origen hasta validar su descripción. |
| `categoria`, `entidad`, `condicion` | Códigos de origen; no asignar significado sin un diccionario oficial. |

Ejemplo recibido: estación **OCOÑA**, código `204504`, coordenadas `[-73.1145, -16.427]`, departamento AREQUIPA. La condición observada es `F`; esta investigación no verificó qué significa.

La respuesta no incluye fecha individual de observación, caudal, nivel de río ni estado de alerta. `fecha_dato` debe quedar ausente/null; `obtenido_en` refleja la hora de consulta y no debe sustituir una fecha de medición. El factor académico puede contar estaciones cercanas como inventario contextual, pero no afirmar crecidas o inundaciones actuales.

La implementación actual configura el endpoint y la capa en el adaptador; no requiere variables externas para esta fuente. Si se externaliza su configuración, pueden usarse nombres como `SENAMHI_WFS_URL` y `SENAMHI_WFS_TYPENAME`; esos nombres son una propuesta, no variables activas. TTL del Word implementado: 900 segundos. Si `totalFeatures` supera los elementos de la página, continuar con `startIndex` y `count`; el lote verificado actualmente es completo. Validar contenido XML de excepciones WFS incluso si HTTP devuelve 200.

Evidencias: `senamhi-capabilities.xml`, `senamhi-hidro-schema.xml` (DescribeFeatureType) y `senamhi-hidro-sample.json` (los 259 registros reales).

## INAIGEM · Lagunas glaciares con riesgo de desborde 2024

**Estado verificado:** metadata y consultas HTTP 200. El conteo devuelve **528 registros**. La consulta de centroides entrega los 528. La fuente es la capa `LGRD2024_`, coincidente con el inventario de riesgo de desborde citado en el Word.

La procedencia se verificó siguiendo el [visor oficial de INAIGEM](https://visor.inaigem.gob.pe/): su JavaScript público enlaza la aplicación ArcGIS `5379ac94516a4cb0a7f1cd0fa7bfc94b`, propiedad de `sig.inaigem`. La configuración de esa aplicación usa el mapa `bdec2717361a410b9eecccbe856d833b`; su capa «Lagunas Glaciares con Riesgo de Desborde» enlaza este servicio:

```text
https://services6.arcgis.com/c9GFTG11debu0wsH/arcgis/rest/services/LGRD2024_/FeatureServer/0
```

[Consultar metadatos del servicio](https://services6.arcgis.com/c9GFTG11debu0wsH/arcgis/rest/services/LGRD2024_/FeatureServer/0?f=json).

La geometría original es **polígono**, en Web Mercator. Para el mapa de puntos y la distancia al epicentro se verificó una consulta que pide al proveedor los centroides en WGS84:

```text
GET {layer}/query
  ?where=1%3D1
  &outFields=FID,Nombre,Cod_lag,Cordillera,Dep,Prov,Distr,NIVEL_R,Area_Km2
  &returnGeometry=false
  &returnCentroid=true
  &f=json
  &outSR=4326
  &orderByFields=FID
  &resultRecordCount=1000
  &resultOffset=0
```

[Abrir la consulta real de centroides](https://services6.arcgis.com/c9GFTG11debu0wsH/arcgis/rest/services/LGRD2024_/FeatureServer/0/query?where=1%3D1&outFields=FID,Nombre,Cod_lag,Cordillera,Dep,Prov,Distr,NIVEL_R,Area_Km2&returnGeometry=false&returnCentroid=true&f=json&outSR=4326&orderByFields=FID&resultRecordCount=1000&resultOffset=0).

| Campo de origen | Uso en SIGRA |
| --- | --- |
| `attributes.FID` | ID de registro; objeto ID publicado por ArcGIS. |
| `Cod_lag`, `Nombre` | Código y nombre de laguna. Conservar nombres genéricos del proveedor. |
| `Cordillera` | Cordillera del inventario. |
| `Dep`, `Prov`, `Distr` | Ubicación textual; no son ubigeos. Algunos registros nombran más de una provincia/distrito. |
| `NIVEL_R` | Clasificación histórica del inventario, separada del índice propio de SIGRA. |
| `Area_Km2` | Área en kilómetros cuadrados. |
| `features[].centroid.x`, `.y` | Longitud y latitud WGS84; punto derivado del polígono por el proveedor. |

Ejemplo recibido: `FID: 2`, Nombre **Tutapac**, Cod_lag `1376749_3`, cordillera Blanca, clasificación `Medio`, centroide `[-77.78440952893024, -8.667345118627024]`. Los campos originales `Lat` y `Long` son cadenas en grados/minutos/segundos; no convertirlos con `parseFloat`. `X`/`Y` no deben interpretarse como lon/lat.

La metadata indica `maxRecordCount: 2000`, paginación disponible y ordenación disponible. La página completa verificada con `resultRecordCount=1000` tiene 528 registros. Para más registros, usar `resultOffset` y `orderByFields=FID`; controlar `exceededTransferLimit` y verificar un conteo independiente con `returnCountOnly=true`. Para geometría real de lagunas usar `returnGeometry=true&outSR=4326`; los centroides deben etiquetarse como tales.

`editingInfo.dataLastEditDate` es `1733330323840`, equivalente a **2024-12-04T16:38:43.840Z**. Es la fecha de edición del dataset, no una observación actual ni la fecha individual de evaluación. Conservar `obtenido_en` de la consulta y describir claramente el año 2024 del inventario. No presentar `NIVEL_R` como una alerta en tiempo real. No existe ubigeo en los campos verificados; mantenerlo null/ausente hasta disponer de una correlación administrativa válida.

La implementación actual configura la capa en el adaptador; no requiere variables externas para esta fuente. `INAIGEM_LAYER_URL` sería un nombre propuesto si se externaliza la configuración, no una variable activa. TTL del Word implementado: 86 400 segundos. Filtrar distancia mediante Haversine sobre los centroides reales para el conteo académico; para análisis geoespacial de impacto haría falta un método y validación distintos.

Evidencias: `inaigem-visor.html`, `inaigem-visor-main.js`, `inaigem-arcgis-app.json`, `inaigem-arcgis-app-data.json`, `inaigem-webmap.json`, `inaigem-lgrd-schema.json`, `inaigem-lgrd-count.json`, `inaigem-lgrd-centroids.json` (528 registros) e `inaigem-lgrd-sample.json` (muestra real de dos polígonos).

## Reglas para integrarlas

- Validar schema y coordenadas; rechazar respuestas con objetos `error` de ArcGIS o excepciones WFS.
- Mostrar `no disponible` cuando falte la fuente. Un resultado vacío tras una consulta válida es distinto de una consulta fallida.
- Cachear solo respuestas reales válidas, con procedencia y hora de obtención. Señalar una copia vencida como degradada.
- Mostrar el radio de consulta y el universo consultado: LGRD2024 no equivale a todas las lagunas del país.
- Conservar las categorías oficiales en sus propios campos. El índice de SIGRA sigue siendo una heurística académica con pesos del Word.
- Los cuatro adaptadores fueron comprobados con peticiones reales desde la API local. El registro de pruebas y la conexión a través de Vite se describen en `VALIDACION_FASE_1.md`; la revisión visual se cierra por separado.

## Ampliación del 12 de octubre de 2026

Población PCM/RENIEC, correlación distrital INEI, composición, contratos SOAP/WFS y fechas se describen en `VALIDACION_FASE_2.md`. El transporte aplica TTL por proveedor, timeout de 25 s y hasta dos reintentos.
