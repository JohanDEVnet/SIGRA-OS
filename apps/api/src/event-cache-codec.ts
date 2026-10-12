import type { PublicEvent } from './provider-parsers.js';
import type { PersistenceCodec } from './persistent-cache.js';
export function eventCacheCodec(year: number): PersistenceCodec<PublicEvent[]> {
  return {
    encode: data => data,
    decode(input) {
      if (!Array.isArray(input) || input.length > 15000) throw new Error('Caché sísmica inválida.');
      const seen = new Set<string>();
      const data = input.map((event): PublicEvent => {
        if (!event || typeof event !== 'object' || typeof event.id !== 'string' || !new RegExp(`^${year}-\\d{4,}$`).test(event.id) || seen.has(event.id) || typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.date) || !Number.isFinite(Date.parse(event.date)) || new Date(event.date).toISOString() !== event.date || typeof event.reference !== 'string' || !event.reference.trim() || (event.region !== null && typeof event.region !== 'string')) throw new Error('Evento persistente no válido.');
        for (const [field, min, max] of [['lat', -90, 90], ['lon', -180, 180], ['magnitude', 0, 10], ['depth', 0, 1000]] as const) if (typeof event[field] !== 'number' || !Number.isFinite(event[field]) || event[field] < min || event[field] > max) throw new Error('Evento persistente fuera de rango.');
        if (event.reportUrl !== null) {
          if (typeof event.reportUrl !== 'string') throw new Error('Enlace IGP persistente no válido.');
          const url = new URL(event.reportUrl);
          if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === 'igp.gob.pe' || url.hostname.endsWith('.igp.gob.pe'))) throw new Error('Enlace fuera de IGP.');
        }
        seen.add(event.id);
        return { id: event.id, date: event.date, lat: event.lat, lon: event.lon, magnitude: event.magnitude, depth: event.depth, reference: event.reference, region: event.region, reportUrl: event.reportUrl };
      });
      return data.sort((a, b) => b.date.localeCompare(a.date));
    },
  };
}
