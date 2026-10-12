import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GeographyAdapter, parseDistricts, selectNearestDistrict } from '../src/geography.js';
import { ProviderTransport } from '../src/transport.js';
const read = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}-real.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
test('intersección oficial INEI resuelve Huaraz sin inferir ubigeos por texto', async () => {
  const real = read('district-contains');
  const adapter = new GeographyAdapter(new ProviderTransport(async (url) => { assert.match(String(url), /INTERSECTS/); return new Response(JSON.stringify(real)); }));
  const result = await adapter.resolveDistrict(-9.53, -77.53);
  assert.equal(result.data.ubigeo, '020101'); assert.equal(result.data.district, 'HUARAZ'); assert.equal(result.data.method, 'contains'); assert.equal(result.data.distanceKm, 0);
  assert.equal(result.data.province, null); assert.equal(result.meta.dateOfData, null);
});
test('epicentro costero usa límite distrital más cercano y muestra distancia/método', async () => {
  const real = read('district-nearest');
  const nearest = selectNearestDistrict(-16.78, -72.56, parseDistricts(real).data);
  assert.equal(nearest.district, 'QUILCA'); assert.equal(nearest.ubigeo, '040207'); assert.ok(nearest.distanceKm > 5 && nearest.distanceKm < 30);
  const adapter = new GeographyAdapter(new ProviderTransport(async (url) => new Response(JSON.stringify(String(url).includes('INTERSECTS') ? { type: 'FeatureCollection', features: [], totalFeatures: 0 } : real))));
  const result = await adapter.resolveDistrict(-16.78, -72.56); assert.equal(result.data.method, 'nearest'); assert.equal(result.data.distanceMethod, 'great_circle_to_polygon_boundary'); assert.ok(result.meta.warnings.some((warning) => warning.includes('sin afirmar pertenencia territorial')));
});
test('rechaza cartografía sin ubigeo o truncada', () => {
  const real = read('district-contains'); assert.throws(() => parseDistricts({ ...real, totalFeatures: 999 }));
  const invalid = structuredClone(real); invalid.features[0].properties.ubigeo = 'HUARAZ'; assert.throws(() => parseDistricts(invalid));
});
