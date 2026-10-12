import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { parseIGP, parseWeather, PublicProviders } from '../src/providers.js';
import { distanceKm, parseLakes, parseStations } from '../src/inventories.js';
export function fixture(name: string) { return JSON.parse(readFileSync(new URL(`./fixtures/${name}-real.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, '')); }
test('respuesta real IGP: combina fecha/hora UTC, publica enlace y no inventa región', () => {
  const response = parseIGP(fixture('igp').records);
  assert.equal(response.data[0].id, '2026-0731');
  assert.equal(response.data[0].date, '2026-10-11T22:44:46.000Z');
  assert.equal(response.data[0].region, 'Ayacucho');
  assert.equal(response.data[0].lat, -14.69);
  assert.ok(response.data[0].reportUrl?.startsWith('https://www.igp.gob.pe/'));
  const unknownRegion = { ...fixture('igp').records[0], referencia: 'Ubicación sin departamento publicado' };
  assert.equal(parseIGP([unknownRegion]).data[0].region, null);
  assert.throws(() => parseIGP({ error: true }));
  assert.throws(() => parseIGP([{ ...unknownRegion, latitud: null }]));
});
test('Open-Meteo real conserva valores del proveedor y su hora UTC', () => {
  const input = fixture('weather').response; const result = parseWeather(input);
  assert.equal(result.data.temperature, input.current.temperature_2m);
  assert.equal(result.data.time, `${input.current.time}:00.000Z`);
  assert.match(result.warnings[0], /modelos/);
  assert.throws(() => parseWeather({ ...input, current: { ...input.current, precipitation: null } }));
});
test('inventarios reales usan geometrías/centroides y rechazan conjuntos truncados', () => {
  const stations = parseStations(fixture('stations').response);
  const lakes = parseLakes(fixture('lakes').response);
  assert.equal(stations.data[0].name, 'OCOÑA');
  assert.equal(stations.data[0].lat, -16.427);
  assert.equal(lakes.data[0].lon, -77.86472799680058);
  assert.match(lakes.warnings[0], /no es una alerta actual/);
  assert.throws(() => parseStations({ ...fixture('stations').response, totalFeatures: 260 }));
  assert.throws(() => parseLakes({ ...fixture('lakes').response, exceededTransferLimit: true }));
  assert.equal(distanceKm(-16.427, -73.1145, stations.data[0]), 0);
  assert.ok(distanceKm(0, 0, { lat: 0, lon: 1 }) > 111 && distanceKm(0, 0, { lat: 0, lon: 1 }) < 112);
});
test('caché real: conserva fecha, limita solicitudes y degrada ante caída sin crear registros', async () => {
  let calls = 0; let now = Date.parse(fixture('igp').obtainedAt); let fail = false;
  const providers = new PublicProviders(async () => { calls++; if (fail) throw new Error('offline'); return new Response(JSON.stringify(fixture('igp').records)); }, () => now, 300_000, { sleep: async () => {} });
  const [first, concurrent] = await Promise.all([providers.igp(2026), providers.igp(2026)]);
  assert.equal(calls, 1); assert.deepEqual(first.data, concurrent.data);
  const cached = await providers.igp(2026); assert.equal(cached.meta.fromCache, true); assert.equal(cached.meta.obtainedAt, first.meta.obtainedAt);
  now += 300_001; fail = true;
  const stale = await providers.igp(2026); assert.equal(stale.meta.status, 'degraded'); assert.deepEqual(stale.data, first.data); assert.equal(stale.meta.obtainedAt, first.meta.obtainedAt);
  assert.equal(providers.sourceStates()[0].status, 'degraded');
  now += 86_400_001; await assert.rejects(providers.igp(2026), ServiceUnavailableException);
  const emptyProviders = new PublicProviders(async () => { throw new Error('offline'); }, Date.now, undefined, { sleep: async () => {} });
  await assert.rejects(emptyProviders.igp(2026), ServiceUnavailableException);
  assert.equal(emptyProviders.sourceStates()[0].status, 'unavailable');
});
