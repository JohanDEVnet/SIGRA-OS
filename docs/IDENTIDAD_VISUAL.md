Mejoras vigentes: búsqueda INEI y proximidad, clusters con paleta verde/marfil/coral, compartir reportes, filtros propios y preferencias locales. «Cómo se conecta» y Hairline se trasladaron a #proyecto; el hero público conserva el paisaje panorámico y se retiraron sus rótulos decorativos.

Estado vigente: por solicitud del usuario, se restauró el diseño anterior con hero panorámico, títulos serif y paleta verde/marfil. Se conservaron las APIs reales y la actualización automática. Las imágenes v2 de Andes y costa se reutilizan en una sección de paisajes después de los reportes. El hero panorámico anterior se conserva. El contenido siguiente documenta el rediseño descartado.

# Identidad pública de SIGRA — rediseño del 12 de octubre

La web usa azul principal #2563eb, azul oscuro #132449, celeste y acentos coral para magnitudes mayores. La tipografía Manrope/DM Sans reemplaza los títulos serif. Los iconos, el símbolo andino y el favicon conservan SVG propios, ahora en la nueva paleta.

Se retiraron de la web pública el catálogo «Cómo se conecta», la figura decorativa Terrain, los pasos explicativos extensos, «Desliza para explorar» y el pie sobre la imagen generada. Los nueve servicios y sus contratos siguen en la API. La procedencia, fechas y advertencias de interpretación se consultan dentro del contexto del reporte.

El último reporte muestra «En vivo» solo con una consulta válida, reciente y sin errores/degradación. La página revisa cada minuto mientras está visible y el feed no está consultándose; el backend mantiene la caché IGP de cinco minutos del Word. Las fechas publicadas no se alteran. El clima y el panorama también se actualizan sin cambiar de sismo; una composición lenta termina antes de procesar la siguiente actualización automática. Ante fallas, se conserva y se identifica la consulta anterior, incluyendo el periodo realmente obtenido.

En móvil, el último reporte va antes de la imagen. Los filtros Periodo/Magnitud son listas propias accesibles por teclado. El mapa distingue magnitudes con colores; el círculo punteado representa el radio académico de consulta, no daños. La actualización no recentra una ubicación que ya se está explorando.

## Imágenes de presentación

Ambas se generaron con la herramienta integrada image_gen, se conservaron los PNG originales y se guardaron versiones WebP en el proyecto. Son paisajes conceptuales, sin relación probatoria con un evento sísmico. Sus textos alternativos los describen como ilustraciones.

- Hero: `apps/web/public/andes-hero-v2.webp`, 1536 × 1024, aproximadamente 447 KB.
- Apoyo: `apps/web/public/peru-coast-v2.webp`, 1536 × 1024, aproximadamente 534 KB, carga diferida.

Prompt del hero: “Photorealistic-natural. Hero photograph for SIGRA, a public website about Peru, earthquakes and geographic context. Luminous landscape inspired by the Peruvian Andes: brilliant turquoise glacial lake, snow-covered peaks, rocky blue-gray terrain and green slopes, clear blue sky and natural warm morning sunlight. Contemporary editorial photography, natural textures, vivid tasteful colors. Wide 3:2 composition inside a rounded image card. No people, disasters, damage, overlays, typography, logos, borders or watermark. Conceptual presentation image, not documentation of an event.”

Prompt de costa: “Conceptual editorial photograph for the SIGRA public geography website. A luminous coastal landscape inspired by Peru, elevated viewpoint, sandy ochre cliffs curving around a calm Pacific bay, turquoise shallows and deep blue water, warm blue sky. Premium natural landscape photography, realistic textures and vibrant natural colors, bright daylight. Horizontal 3:2. Conceptual support, not a real disaster record. No people, disasters, text, logos, watermarks or map overlays.”
