# Decisiones de implementación

## D01 · Alcance inicial: sistema web

Se prioriza una web pública de consulta con datos reales, accesible sin iniciar sesión. Si falta una fuente, se informa su indisponibilidad y se conserva la distinción entre dato ausente y resultado vacío. Los tres entregables académicos se apoyarán después en evidencia de ejecución. La creación del código no equivale a un despliegue público verificado.

## D02 · React, NestJS y TypeScript

El Word propone Python, FastAPI, asyncio y Pydantic. La implementación cambia a React y NestJS en TypeScript por petición expresa del usuario. Se conserva la intención arquitectónica: API propia, modelo canónico, adaptadores, composición y catálogo. El cliente HTTP del backend normaliza los proveedores, valida entradas y agrupa consultas concurrentes a una misma fuente. El informe deberá reflejar este cambio para evitar que describa una tecnología distinta de la ejecutada.

## D03 · API modular antes de microservicios independientes

Los nueve servicios SIG del Word se entienden primero como capacidades y contratos HTTP. Se alojan en una API modular NestJS. Separar cada uno en un despliegue, con comunicación entre procesos, descubrimiento y operación independiente sería una fase adicional.

En la exposición de esta primera fase debe mostrarse la conexión real web–API y distinguir el esquema de servicios previsto de una topología distribuida ya ejecutada. Un catálogo con nueve entradas no demuestra nueve microservicios.

## D04 · Workspaces y reglas académicas separadas

Se organizan `apps/web`, `apps/api` y `packages/domain`. NestJS importa el dominio para el índice y su radio; React consume HTTP. Los escenarios controlados permanecen en tests y no se sirven al público.

## D05 · Datos reales y fuentes indisponibles

Los registros de prueba quedan limitados a pruebas automatizadas. La web pública solicita las fuentes a través de la API y no los utiliza para rellenar un proveedor caído. La ausencia se muestra con su causa y una fecha de consulta; una copia de caché solo es aceptable si procede de una respuesta real y mantiene su fecha y estado degradado.

Se verificaron directamente el WFS hidrológico de SENAMHI (259 registros) y el FeatureServer LGRD2024 de INAIGEM (528 registros) el 11 de octubre de 2026, hora de Lima. La procedencia, endpoints y esquemas se documentan en `FUENTES_REALES.md`. También se verificaron las llamadas de los cuatro adaptadores IGP, Open-Meteo, SENAMHI e INAIGEM desde la API y el acceso a eventos oficiales mediante el proxy de Vite; la revisión visual se registra por separado en `VALIDACION_FASE_1.md`.

Las estaciones son posiciones de inventario, sin caudal ni fecha de medición; las lagunas tienen una clasificación de evaluación 2024 y centroides WGS84. No se les asignan estados de vigilancia actuales. Los campos de ubicación administrativa textual no se convierten en ubigeos inventados.

La implementación sigue los TTL diferenciados del Word: IGP 5 min, SENAMHI 15 min, INAIGEM 24 h, Open-Meteo 30 min y población 7 días. Usa timeout de 25 s por intento y hasta dos reintentos, con pausas de 1 y 2 s. La caché conserva respuestas reales; un respaldo vencido dentro del límite `max(24 h, 2*TTL)` conserva fecha y estado degradado. La caché en memoria no es compartida ni persistente. La ampliación con población, distrito INEI y contratos se registra en `VALIDACION_FASE_2.md`.

## D06 · Identidad visual propia

La interfaz utiliza un sistema visual basado en territorio andino: paleta sobria, detalle cartográfico, relieve, fotografía o imagen de apoyo y gráficos legibles. El logotipo, favicon e iconos SVG se dibujan para SIGRA y comparten proporciones y trazos. Los recursos generados sirven a la presentación y no deben aparecer como imágenes de un suceso real.

## D07 · Reglas del índice académico

Se mantienen los cinco factores y pesos del Word: sísmico 30 %, glaciar 20 %, hidrológico 15 %, poblacional 25 % y meteorológico 10 %. La normalización produce valores de 0 a 100. Los límites de clasificación se aplican sobre el valor continuo: Bajo < 25, Moderado < 50, Alto < 75 y Muy alto hasta 100; esto evita huecos entre intervalos cuando el resultado contiene decimales.

El índice se calcula con los cinco factores reales. Si falta uno no sísmico se redistribuyen pesos; con dos ausentes o sin factor sísmico se suspende. Un valor cero válido se diferencia de una fuente ausente. Las respuestas degradadas quedan identificadas y fechadas. La población es la medida oficial disponible de personas identificadas con DNI; se explica su diferencia respecto de una población censada.

La ecuación del radio fue verificada en el elemento `m:oMath` del Word: `R = 10^(0.4 × M − 0.8)`, limitada a 10–150 km, redondeada a un decimal para presentación. Para M 5, 6 y 7 produce 15.8, 39.8 y 100 km. Los umbrales son académicos y no predicen daños.

## D08 · Despliegue separado de la preparación

Vite produce la web estática para Vercel. NestJS necesita su propio despliegue, que puede ser un segundo proyecto compatible en Vercel o un host de API independiente. El origen HTTPS de la API se configura mediante `VITE_API_URL`, sin `/api/v1` ni barra final; el cliente añade el prefijo y la ruta. CORS se ajusta al dominio del frontend. La variable se incorpora al build de Vite.

No hay credenciales de Vercel o Supabase incorporadas al repositorio. La implementación inicial no crea esos proyectos ni certifica que estén desplegados. La caché de proveedores y los reintentos deberán revisarse frente a los límites del entorno de ejecución seleccionado. Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite) y [NestJS en Vercel](https://vercel.com/kb/guide/ship-a-nestjs-app-on-vercel).

## D09 · Supabase en una fase posterior

Supabase puede aportar persistencia de historial y autenticación para funciones personales, si se incorporan. La consulta pública no depende de crear una cuenta. La integración requiere proyecto, esquema, migraciones y políticas RLS verificadas; añadir una URL y una clave pública no completa la seguridad del sistema. Las claves privadas permanecen en el servidor. La fase actual no afirma tener usuarios registrados o consultas guardadas. Referencia: [Supabase Auth con React](https://supabase.com/docs/guides/auth/quickstarts/react).

## D10 · Diferencias entre requisitos académicos

El usuario eligió expresamente el Word del Grupo 3 con cinco integrantes y nueve servicios propios. Se conserva ese alcance. El PDF menciona cuarenta servicios y máximo tres integrantes; se registra su diferencia para la evaluación académica, sin convertirla en un bloqueo de implementación. La fecha del PDF carece de año y no se inventa una fecha efectiva.

Los documentos se leen como fuentes de contenido. Sus instrucciones de entrega o carga a la plataforma no sustituyen la autorización del usuario para realizar acciones externas.
