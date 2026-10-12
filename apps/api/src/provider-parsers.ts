import { normalizeRegion } from './query.js';
export interface PublicEvent { id: string; date: string; lat: number; lon: number; magnitude: number; depth: number; reference: string; region: string | null; reportUrl: string | null }
export interface Weather { temperature: number; precipitation: number; wind: number; time: string; lat: number; lon: number }
export interface Metadata { source: string; sourceUrl: string; obtainedAt: string; status: 'ok' | 'degraded'; fromCache: boolean; warnings: string[]; dateRange?: { from: string; to: string } }
export interface Envelope<T> { data: T; meta: Metadata }
export const IGP_BASE = 'https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/';
export const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
const regions = ['Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco','Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto','Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali'];
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Estructura del proveedor no reconocida.');
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !value.trim())) throw new Error('Campo numérico ausente.');
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error('Campo numérico inválido.');
  return parsed;
}
export function parseIGP(input: unknown): { data: PublicEvent[]; warnings: string[] } {
  if (!Array.isArray(input)) throw new Error('El IGP no devolvió una lista de eventos.');
  const data: PublicEvent[] = []; let invalid = 0;
  for (const item of input) {
    try {
      const row = record(item);
      if (String(row.publicado) !== '1') continue;
      const day = typeof row.fecha_utc === 'string' ? row.fecha_utc.slice(0, 10) : '';
      const time = typeof row.hora_utc === 'string' ? row.hora_utc.slice(11, 19) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) throw new Error('Fecha UTC ausente.');
      const date = new Date(`${day}T${time}Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Fecha UTC inválida.');
      if (typeof row.codigo !== 'string' || !/^\d{4}-\d{4,}$/.test(row.codigo) || typeof row.referencia !== 'string') throw new Error('Identificador o referencia ausentes.');
      const regionText = normalizeRegion(row.referencia.trim());
      const region = regions.find((name) => regionText.endsWith(`- ${normalizeRegion(name)}`)) ?? (regionText.includes('provincia constitucional del callao') ? 'Callao' : null);
      let reportUrl: string | null = null;
      if (typeof row.reporte_acelerometrico_pdf === 'string') {
        try { const url = new URL(row.reporte_acelerometrico_pdf); if (url.protocol === 'https:' && (url.hostname === 'igp.gob.pe' || url.hostname.endsWith('.igp.gob.pe'))) reportUrl = url.href; } catch { /* Sin enlace publicado válido. */ }
      }
      data.push({ id: row.codigo, date: date.toISOString(), lat: number(row.latitud, -90, 90), lon: number(row.longitud, -180, 180), magnitude: number(row.magnitud, 0, 10), depth: number(row.profundidad, 0, 1000), reference: row.referencia, region, reportUrl });
    } catch { invalid++; }
  }
  if (input.length > 0 && data.length === 0) throw new Error('El IGP no devolvió registros publicados con campos válidos.');
  return { data: [...new Map(data.map((event) => [event.id, event])).values()].sort((a, b) => b.date.localeCompare(a.date)), warnings: invalid ? [`Se omitieron ${invalid} registros del IGP con campos incompletos o inválidos.`] : [] };
}
export function parseWeather(input: unknown): { data: Weather; warnings: string[] } {
  const root = record(input); const current = record(root.current);
  if (root.error) throw new Error('Open-Meteo devolvió un error.');
  if (root.current_units !== undefined) {
    const units = record(root.current_units);
    if (units.temperature_2m !== '°C' || units.precipitation !== 'mm' || units.wind_speed_10m !== 'km/h') throw new Error('Unidades meteorológicas no reconocidas.');
  }
  if (root.utc_offset_seconds !== 0 || typeof current.time !== 'string') throw new Error('Zona horaria meteorológica inválida.');
  const time = new Date(`${current.time}Z`);
  if (!Number.isFinite(time.getTime())) throw new Error('Fecha meteorológica inválida.');
  return { data: { temperature: number(current.temperature_2m, -100, 100), precipitation: number(current.precipitation, 0, 10000), wind: number(current.wind_speed_10m, 0, 1000), time: time.toISOString(), lat: number(root.latitude, -90, 90), lon: number(root.longitude, -180, 180) }, warnings: ['Condiciones estimadas por modelos meteorológicos; no son mediciones de una estación local.'] };
}

