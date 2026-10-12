import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProviderTransport } from './transport.js';
import type { Parsed, ProviderEnvelope } from './transport.js';
export const DISTRICT_WFS_BASE = 'https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows';
export type Position = [number, number];
export interface DistrictPolygon { ubigeo: string; district: string; polygons: Position[][][] }
export interface DistrictResolution { ubigeo: string; district: string; province: string | null; region: string | null; method: 'contains' | 'nearest'; distanceKm: number; referencePoint?: { lat: number; lon: number }; distanceMethod?: 'great_circle_to_polygon_boundary'; searchRadiusKm?: number }
export function districtQueryUrl(lat: number, lon: number, radiusKm?: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new BadRequestException('Coordenadas fuera de rango.');
  const cql = radiusKm === undefined ? `INTERSECTS(geom,POINT(${lon} ${lat}))` : `DWITHIN(geom,POINT(${lon} ${lat}),${radiusKm},kilometers)`;
  return `${DISTRICT_WFS_BASE}?${new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: 'Interoperabilidad:ig_distrito', outputFormat: 'application/json', srsName: 'EPSG:4326', CQL_FILTER: cql, maxFeatures: '2000' })}`;
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta geográfica no válida.'); return value as Record<string, unknown>; }
export function parseDistricts(input: unknown): Parsed<DistrictPolygon[]> {
  const root = object(input);
  if (root.type !== 'FeatureCollection' || !Array.isArray(root.features)) throw new Error('INEI no devolvió GeoJSON.');
  if (typeof root.totalFeatures === 'number' && root.totalFeatures > root.features.length) throw new Error('INEI devolvió polígonos incompletos.');
  const data = root.features.map((feature): DistrictPolygon => {
    const row = object(feature); const props = object(row.properties); const geometry = object(row.geometry);
    if (typeof props.ubigeo !== 'string' || !/^\d{6}$/.test(props.ubigeo) || typeof props.nombdist !== 'string' || !props.nombdist.trim()) throw new Error('INEI no publicó ubigeo o nombre distrital válido.');
    const rawPolygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : null;
    if (!Array.isArray(rawPolygons) || !rawPolygons.length) throw new Error('Distrito sin geometría poligonal.');
    const polygons = rawPolygons.map((polygon): Position[][] => {
      if (!Array.isArray(polygon) || !polygon.length) throw new Error('Polígono distrital incompleto.');
      return polygon.map((ring): Position[] => {
        if (!Array.isArray(ring) || ring.length < 4) throw new Error('Anillo distrital incompleto.');
        const parsed = ring.map((point): Position => {
          if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number' || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Coordenadas distritales fuera de WGS84.');
          return [point[0], point[1]];
        });
        if (parsed[0][0] !== parsed[parsed.length - 1][0] || parsed[0][1] !== parsed[parsed.length - 1][1]) throw new Error('Anillo distrital sin cierre.');
        return parsed;
      });
    });
    return { ubigeo: props.ubigeo, district: props.nombdist.trim(), polygons };
  });
  return { data, dateOfData: null, warnings: ['Límites distritales referenciales del servicio WFS oficial INEI. El servicio no declara una fecha de vigencia legal de cada límite; no se usa la fecha de registro como fecha de observación.'] };
}
const R = 6371.0088;
type Vector = [number, number, number];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (v: Vector) => Math.hypot(...v);
const angle = (a: Vector, b: Vector) => Math.atan2(length(cross(a, b)), Math.max(-1, Math.min(1, dot(a, b))));
function vector(point: Position): Vector { const lon = point[0] * Math.PI / 180; const lat = point[1] * Math.PI / 180; return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; }
function position(v: Vector): Position { return [Math.atan2(v[1], v[0]) * 180 / Math.PI, Math.atan2(v[2], Math.hypot(v[0], v[1])) * 180 / Math.PI]; }
export function nearestBoundary(point: Position, polygon: DistrictPolygon): { distanceKm: number; referencePoint: Position } {
  const p = vector(point); let bestDistance = Infinity; let best: Position = point;
  const candidate = (v: Vector) => { const distance = R * angle(p, v); if (distance < bestDistance) { bestDistance = distance; best = position(v); } };
  for (const rings of polygon.polygons) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
    const a = vector(ring[i - 1]); const b = vector(ring[i]); candidate(a); candidate(b);
    const n = cross(a, b); const norm = length(n); if (norm < 1e-14) continue;
    const unit: Vector = [n[0] / norm, n[1] / norm, n[2] / norm]; const projection = dot(p, unit);
    const q: Vector = [p[0] - projection * unit[0], p[1] - projection * unit[1], p[2] - projection * unit[2]]; const qNorm = length(q); if (qNorm < 1e-14) continue;
    const normalized: Vector = [q[0] / qNorm, q[1] / qNorm, q[2] / qNorm];
    if (angle(a, normalized) + angle(normalized, b) <= angle(a, b) + 1e-9) candidate(normalized);
  }
  return { distanceKm: bestDistance, referencePoint: best };
}
export function selectNearestDistrict(lat: number, lon: number, districts: DistrictPolygon[]): DistrictResolution {
  let result: DistrictResolution | null = null;
  for (const district of districts) {
    const near = nearestBoundary([lon, lat], district);
    if (!result || near.distanceKm < result.distanceKm) result = { ubigeo: district.ubigeo, district: district.district, province: null, region: null, method: 'nearest', distanceKm: near.distanceKm, referencePoint: { lon: near.referencePoint[0], lat: near.referencePoint[1] }, distanceMethod: 'great_circle_to_polygon_boundary' };
  }
  if (!result) throw new NotFoundException('No se encontró un distrito de análisis en la cartografía INEI consultada.');
  return result;
}
export class GeographyAdapter {
  constructor(private transport: ProviderTransport) {}
  async resolveDistrict(lat: number, lon: number): Promise<ProviderEnvelope<DistrictResolution>> {
    const contained = await this.transport.json(`district:contains:${lat}:${lon}`, 'INEI', districtQueryUrl(lat, lon), 86_400_000, parseDistricts);
    if (contained.data.length) {
      const district = [...contained.data].sort((a, b) => a.ubigeo.localeCompare(b.ubigeo))[0];
      return { data: { ubigeo: district.ubigeo, district: district.district, province: null, region: null, method: 'contains', distanceKm: 0 }, meta: { ...contained.meta, warnings: [...contained.meta.warnings, ...(contained.data.length > 1 ? ['El punto intersecta más de un límite; se eligió el menor código ubigeo y la asignación debe revisarse.'] : [])] } };
    }
    for (const radiusKm of [100, 300, 1000]) {
      const nearby = await this.transport.json(`district:near:${lat}:${lon}:${radiusKm}`, 'INEI', districtQueryUrl(lat, lon, radiusKm), 86_400_000, parseDistricts);
      if (!nearby.data.length) continue;
      const data = selectNearestDistrict(lat, lon, nearby.data); data.searchRadiusKm = radiusKm;
      return { data, meta: { ...nearby.meta, durationMs: (contained.meta.durationMs ?? 0) + (nearby.meta.durationMs ?? 0), status: contained.meta.status === 'degraded' || nearby.meta.status === 'degraded' ? 'degraded' : 'ok', warnings: [...new Set([...contained.meta.warnings, ...nearby.meta.warnings]), 'El epicentro no intersecta un polígono distrital. Se utiliza el distrito más próximo a su límite como criterio de consulta, sin afirmar pertenencia territorial ni daños.'] } };
    }
    throw new NotFoundException({ statusCode: 404, message: 'No se encontró un distrito INEI a menos de 1000 km. No se asigna un ubigeo inventado.' });
  }
}
