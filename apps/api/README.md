# SIGRA API pública

NestJS y TypeScript conectan las fuentes reales con la web React. La API importa `@sigra/domain` para aplicar los factores y las reglas del Word. No sirve fixtures ni cifras sustitutas.

Desde la raíz del repositorio:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

API: `http://127.0.0.1:3001/api/v1`. Para ejecutar solo el backend, compilar primero `@sigra/domain` y después ejecutar `npm.cmd run dev --workspace @sigra/api`. Producción: `npm.cmd run build` y `npm.cmd run start --workspace @sigra/api`.

| Servicio | GET | Resultado |
| --- | --- | --- |
| SIG-01 | `/sismos?mag_min=4&dias=7` | Reportes oficiales IGP del año UTC consultado; `anio` y `region` opcionales. |
| SIG-02 | `/hidrologia/estaciones` | Inventario SENAMHI; filtros `region`, `lat`, `lon`, `radio_km`. |
| SIG-03 | `/glaciares/lagunas` | Centroides del inventario INAIGEM LGRD2024; mismos filtros. |
| SIG-04 | `/poblacion/020101` | Personas identificadas con DNI por ubigeo INEI, procedencia RENIEC/PCM y trimestre de referencia. |
| SIG-05 | `/meteorologia/actual?lat=-14.69&lon=-73.65` | Condiciones estimadas actuales: °C, mm y km/h. |
| SIG-06 | `/riesgo/panorama?evento_id=2026-0731` | Distrito, cinco factores, índice académico, fechas, advertencias y traza. |
| SIG-07 | `/catalogo/servicios` | Nueve contratos propios implementados. |
| SIG-08 | `/catalogo/contrato-soap` | Inspección del WSDL de SUNAT, sin ejecutar operaciones de facturación. |
| SIG-09 | `/catalogo/contrato-wfs` | Capabilities WFS de SENAMHI. |

Rutas técnicas: `/health`, `/fuentes`, `/openapi.json` (OpenAPI 3.1) y `/docs`. Health indica que el proceso está disponible; no certifica los proveedores.

La composición consulta INEI para identificar el distrito. En epicentros fuera de un polígono usa el distrito más cercano a su límite, lo identifica como referencia y muestra la distancia. Los recuentos usan Haversine. El radio del Word es `10^(0.4*M-0.8)`, limitado a 10–150 km. Un factor no sísmico ausente redistribuye pesos; dos ausentes o falta de IGP suspenden el índice. Un cero real se conserva.

Población identificada con DNI no equivale a censo ni a afectados. La fecha de referencia se deriva del cierre del trimestre declarado por el recurso. Las estaciones no aportan caudal actual; las lagunas conservan su clasificación de inventario 2024. El índice es una propuesta académica.

Respuestas: `{data,meta:{source,sourceUrl,obtainedAt,status,fromCache,warnings,...}}`. TTL: IGP 5 min, SENAMHI 15 min, INAIGEM 24 h, Open-Meteo 30 min, población 7 días. Cada intento tiene 25 s de timeout y hasta dos reintentos, con pausas de 1 y 2 s cuando corresponda. Panorama limita la composición a 85 s. Caché en memoria, agrupación de llamadas concurrentes y recuperación del último dato real con estado degradado y fecha conservada, hasta `max(24 h, 2*TTL)`; no se garantiza persistencia entre reinicios.

Variables: `PORT` (3001), `HOST` (127.0.0.1; 0.0.0.0 para contenedor), `CORS_ORIGINS` (orígenes separados por comas) y `API_KEY` opcional. No se cargan archivos `.env` automáticamente. Límite: 60 solicitudes por minuto y cliente; HTTP 429 con Retry-After. Cada respuesta incorpora X-Request-ID. Si se habilita API_KEY, usar un consumidor servidor apropiado; una clave privada no debe incorporarse al bundle público de React.

Pruebas: `npm.cmd test` desde la raíz. Los tests usan respuestas controladas; las consultas en vivo se documentan por separado en `docs/VALIDACION_FASE_2.md`.

## Estados verificables y comprobación en vivo

`/catalogo/servicios` incorpora `availability`: estado, última consulta, último éxito y detalle. La implementación del contrato se distingue de la última respuesta del proveedor. `/fuentes` incluye los descriptores de SUNAT y SENAMHI-WFS. Estos estados son del proceso actual; al reiniciar se vuelven a consultar las fuentes.

Desde la raíz, con web y API abiertas: `npm.cmd run verify:live`. Comprueba los nueve servicios, OpenAPI y la conexión mediante el proxy de Vite; guarda evidencia fechada y termina con error ante fallos. Para otros entornos se pueden establecer `SIGRA_API_URL` y `SIGRA_WEB_URL` con sus orígenes, sin `/api/v1`; una API Key opcional se lee de `SIGRA_API_KEY` y no se imprime. La comprobación espera un panorama completo; un resultado parcial real queda registrado y se considera verificación pendiente, sin sustituir factores.
