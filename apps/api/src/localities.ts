import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { DISTRICT_WFS_BASE, parseDistricts } from './geography.js';
import type { DistrictPolygon, Position } from './geography.js';
import { ProviderTransport } from './transport.js';
import type { ProviderEnvelope } from './transport.js';
import type { PersistenceCodec } from './persistent-cache.js';

export interface Locality { ubigeo: string; district: string; province: null; region: null; lat: number; lon: number; coordinateMethod: 'polygon_centroid' }
interface LocalitySearch { rows: Locality[]; hasMore: boolean }
function localityCodec(limit: number): PersistenceCodec<LocalitySearch> {
  return { encode: data => data, decode(input) {
    if (!input || typeof input !== 'object') throw new Error('Búsqueda persistente no válida.');
    const result = input as LocalitySearch;
    if (!Array.isArray(result.rows) || result.rows.length > limit || typeof result.hasMore !== 'boolean') throw new Error('Búsqueda persistente incompleta.');
    const seen = new Set<string>();
    const rows = result.rows.map(row => {
      if (!row || typeof row.ubigeo !== 'string' || !/^\d{6}$/.test(row.ubigeo) || seen.has(row.ubigeo) || typeof row.district !== 'string' || !row.district.trim() || row.province !== null || row.region !== null || typeof row.lat !== 'number' || !Number.isFinite(row.lat) || Math.abs(row.lat) > 90 || typeof row.lon !== 'number' || !Number.isFinite(row.lon) || Math.abs(row.lon) > 180 || row.coordinateMethod !== 'polygon_centroid') throw new Error('Distrito persistente no válido.');
      seen.add(row.ubigeo);
      return { ubigeo: row.ubigeo, district: row.district, province: null, region: null, lat: row.lat, lon: row.lon, coordinateMethod: 'polygon_centroid' } as Locality;
    });
    return { rows, hasMore: result.hasMore };
  } };
}
function validateSearch(q: string, limit: number) {
  if (typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 80 || !/^[\p{L}\p{N}\p{M}\s.'’\-]+$/u.test(q)) throw new BadRequestException('q debe contener de 2 a 80 caracteres del nombre o ubigeo distrital.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new UnprocessableEntityException('limite debe ser un entero entre 1 y 12.');
}
const xmlText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function localityQueryUrl(q: string, limit: number): string {
  validateSearch(q, limit);
  const original = q.trim().replace(/\s+/g, ' ').toUpperCase();
  const plain = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filters = [...new Set([original, plain])].map(value => `<PropertyIsLike wildCard="*" singleChar="?" escapeChar="!" matchCase="false"><PropertyName>nombdist</PropertyName><Literal>*${xmlText(value)}*</Literal></PropertyIsLike>`);
  if (/^\d{6}$/.test(original)) filters.push(`<PropertyIsEqualTo><PropertyName>ubigeo</PropertyName><Literal>${original}</Literal></PropertyIsEqualTo>`);
  const filter = `<Filter xmlns="http://www.opengis.net/ogc">${filters.length > 1 ? `<Or>${filters.join('')}</Or>` : filters[0]}</Filter>`;
  return `${DISTRICT_WFS_BASE}?${new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'Interoperabilidad:ig_distrito', outputFormat: 'application/json', srsName: 'EPSG:4326', FILTER: filter, maxFeatures: String(limit + 1), sortBy: 'nombdist,ubigeo' })}`;
}
/** Area centroid in longitude/latitude, including holes. Derived from the official geometry. */
export function polygonCentroid(district: DistrictPolygon): Position {
  let areaTotal = 0, xTotal = 0, yTotal = 0;
  for (const polygon of district.polygons) for (let r = 0; r < polygon.length; r++) {
    const ring = polygon[r]; const origin = ring[0];
    let twiceArea = 0, cx = 0, cy = 0;
    // Translate before computing shoelace products to avoid cancellation at Peru's longitude.
    for (let i = 1; i < ring.length; i++) {
      const ax = ring[i - 1][0] - origin[0], ay = ring[i - 1][1] - origin[1];
      const bx = ring[i][0] - origin[0], by = ring[i][1] - origin[1];
      const cross = ax * by - bx * ay; twiceArea += cross; cx += (ax + bx) * cross; cy += (ay + by) * cross;
    }
    if (Math.abs(twiceArea) < 1e-14) continue;
    const area = Math.abs(twiceArea) / 2 * (r === 0 ? 1 : -1);
    xTotal += (origin[0] + cx / (3 * twiceArea)) * area;
    yTotal += (origin[1] + cy / (3 * twiceArea)) * area; areaTotal += area;
  }
  if (areaTotal <= 0) throw new Error('Geometría sin área válida para calcular un centroide.');
  const result: Position = [xTotal / areaTotal, yTotal / areaTotal];
  if (!result.every(Number.isFinite) || Math.abs(result[0]) > 180 || Math.abs(result[1]) > 90) throw new Error('Centroide fuera de WGS84.');
  return result;
}
export class LocalitiesAdapter {
  constructor(private transport: ProviderTransport) {}
  async search(q: string, limit = 10): Promise<ProviderEnvelope<Locality[]> & { meta: { scope: 'administrative_districts'; limit: number; hasMore: boolean } }> {
    const url = localityQueryUrl(q, limit);
    const result = await this.transport.json(`localities:${url}`, 'INEI', url, 86_400_000, input => {
      if (!input || typeof input !== 'object') throw new Error('Respuesta de búsqueda INEI inválida.');
      const root = input as { features?: unknown[]; totalFeatures?: unknown; type?: unknown };
      if (!Array.isArray(root.features) || root.features.length > limit + 1 || (typeof root.totalFeatures === 'number' && root.totalFeatures < root.features.length)) throw new Error('Respuesta de búsqueda INEI incoherente.');
      // A name search is intentionally bounded; resolution of epicentres still requires full geometry results.
      const parsed = parseDistricts({ ...root, totalFeatures: root.features.length });
      const hasMore = root.features.length > limit || (typeof root.totalFeatures === 'number' && root.totalFeatures > limit);
      const data = parsed.data.slice(0, limit).map(district => {
        const [lon, lat] = polygonCentroid(district);
        return { ubigeo: district.ubigeo, district: district.district, province: null, region: null, lat, lon, coordinateMethod: 'polygon_centroid' } as Locality;
      });
      return { data: { rows: data, hasMore }, dateOfData: null, warnings: [...parsed.warnings, 'Resultados de distritos administrativos, no direcciones ni capitales distritales. Coordenadas calculadas como centroide del polígono INEI en WGS84; pueden quedar fuera de polígonos cóncavos. Provincia y departamento no se publican en esta capa y se conservan como null.', ...(hasMore ? ['La búsqueda tiene más resultados. Precise el nombre para reducir coincidencias.'] : [])] };
    }, localityCodec(limit));
    return { data: result.data.rows, meta: { ...result.meta, scope: 'administrative_districts', limit, hasMore: result.data.hasMore } };
  }
}
