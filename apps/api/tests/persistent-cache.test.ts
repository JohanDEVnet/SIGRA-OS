import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { PopulationAdapter } from '../src/population.js';
import { ProviderTransport } from '../src/transport.js';
import { PublicProviders } from '../src/providers.js';
import { createSupabaseCacheFromEnv, SupabasePublicCache } from '../src/persistent-cache.js';
import type { PersistentCacheRecord, PersistentCacheStore } from '../src/persistent-cache.js';
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}-real.json`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const csv = readFileSync(new URL('./fixtures/population-huaraz-real.csv', import.meta.url), 'utf8');
const initialTime = Date.parse('2026-10-12T00:00:00Z');
class MemoryStore implements PersistentCacheStore {
  rows = new Map<string, PersistentCacheRecord>();
  async get(key: string) { return structuredClone(this.rows.get(key) ?? null); }
  async put(record: PersistentCacheRecord) { this.rows.set(record.key, structuredClone(record)); }
}
const upstream: typeof fetch = async url => new Response(String(url).includes('package_show') ? JSON.stringify(fixture('population-ckan')) : csv);
const adapter = (store: PersistentCacheStore, fetcher: typeof fetch, time = initialTime) => new PopulationAdapter(new ProviderTransport(fetcher, () => time, { retries: 0, persistentStore: store }), () => time);

test('RENIEC persiste sólo agregado público y reinicio evita descargar de nuevo el CSV', async () => {
  const store = new MemoryStore();
  const first = await adapter(store, upstream).realPopulation('020101');
  assert.equal(first.data.population, 70074);
  assert.equal(store.rows.size, 2);
  const snapshot = [...store.rows.values()].find(row => row.key.startsWith('population:csv:'))!;
  const serialized = JSON.stringify(snapshot.payload);
  assert.ok(serialized.includes('70074')); assert.ok(!serialized.includes('TipoDNI')); assert.ok(!serialized.includes('Sexo')); assert.ok(!serialized.includes('Edad'));
  let calls = 0;
  const second = await adapter(store, async () => { calls++; throw new Error('upstream offline'); }, initialTime + 1000).realPopulation('020101');
  assert.equal(calls, 0); assert.equal(second.data.population, 70074); assert.equal(second.meta.fromCache, true); assert.equal(second.meta.cacheLayer, 'supabase');
  assert.equal(second.meta.obtainedAt, first.meta.obtainedAt); assert.equal(second.meta.dateOfData, '2026-06-30');
});
test('respaldo persistente vencido conserva fechas y estado degraded; a los15d no inventa respuesta', async () => {
  const store = new MemoryStore(); const first = await adapter(store, upstream).realPopulation('020101');
  const failed: typeof fetch = async () => { throw new Error('offline'); };
  const stale = await adapter(store, failed, initialTime + 8 * 86400000).realPopulation('020101');
  assert.equal(stale.meta.status, 'degraded'); assert.equal(stale.meta.obtainedAt, first.meta.obtainedAt); assert.equal(stale.meta.cacheLayer, 'supabase');
  assert.match(stale.meta.warnings.join(' '), /última respuesta real/);
  await assert.rejects(adapter(store, failed, initialTime + 15 * 86400000).realPopulation('020101'), ServiceUnavailableException);
});
test('rechaza caché poblacional corrupta y vuelve a fuente oficial', async () => {
  const store = new MemoryStore(); await adapter(store, upstream).realPopulation('020101');
  const record = [...store.rows.values()].find(row => row.key.startsWith('population:csv:'))!;
  (record.payload as { data: { population: number }[] }).data[0].population = -999;
  let calls = 0;
  const response = await adapter(store, async url => { calls++; return upstream(url); }).realPopulation('020101');
  assert.equal(calls, 1); assert.equal(response.data.population, 70074); assert.ok(response.meta.warnings.some(w => w.includes('caché persistente')));
});
test('fallo de Supabase no rompe datos oficiales y health no afirma conexión configurada', async () => {
  const store: PersistentCacheStore = { async get() { throw new Error('down'); }, async put() { throw new Error('down'); } };
  const transport = new ProviderTransport(upstream, () => initialTime, { retries: 0, persistentStore: store });
  assert.equal(transport.persistenceStatus().status, 'not-queried');
  const result = await new PopulationAdapter(transport, () => initialTime).realPopulation('020101');
  assert.equal(result.data.population, 70074); assert.equal(result.meta.status, 'ok'); assert.equal(transport.persistenceStatus().status, 'degraded');
  assert.ok(result.meta.warnings.some(w => w.includes('no se pudo guardar')));
});
test('IGP real se recupera desde Supabase tras reinicio y no rejuvenece fechas', async () => {
  const store = new MemoryStore();
  const first = await new PublicProviders(async () => new Response(JSON.stringify(fixture('igp').records)), () => initialTime, undefined, { retries: 0, persistentStore: store }).igp(2026);
  const second = await new PublicProviders(async () => { throw new Error('offline'); }, () => initialTime + 60000, undefined, { retries: 0, persistentStore: store }).igp(2026);
  assert.deepEqual(second.data, first.data); assert.equal(second.meta.cacheLayer, 'supabase'); assert.equal(second.meta.obtainedAt, first.meta.obtainedAt);
});
test('REST Supabase utiliza secreto moderno apikey, JWT legacy Bearer y upsert serializado', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const request: typeof fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return init.method === 'POST' ? new Response(null, { status: 201 }) : new Response('[]'); };
  const store = new SupabasePublicCache('https://test.supabase.co', 'sb_secret_test_only', request);
  assert.equal(await store.get('population:descriptor'), null);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.apikey, 'sb_secret_test_only'); assert.equal(headers.Authorization, undefined); assert.equal(calls[0].init.redirect, 'error');
  const record: PersistentCacheRecord = { key: 'population:descriptor', source: 'PCM / RENIEC', sourceUrl: 'https://www.datosabiertos.gob.pe/', obtainedAt: new Date(initialTime).toISOString(), storedAt: initialTime, expiresAt: initialTime + 604800000, staleUntil: initialTime + 1209600000, payload: { version: 1, data: {} } };
  await store.put(record); assert.match(calls[1].url, /on_conflict=cache_key/); assert.equal((calls[1].init.headers as Record<string, string>).Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.equal(JSON.parse(String(calls[1].init.body)).obtained_at, record.obtainedAt);
  const jwt = `eyJ.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.test`;
  await new SupabasePublicCache('https://test.supabase.co', jwt, request).get('IGP:2026');
  assert.equal((calls[2].init.headers as Record<string, string>).Authorization, `Bearer ${jwt}`);
  assert.equal(createSupabaseCacheFromEnv({}), undefined); assert.throws(() => createSupabaseCacheFromEnv({ SUPABASE_URL: 'https://test.supabase.co' }));
  assert.throws(() => new SupabasePublicCache('https://test.supabase.co', 'sb_publishable_test'));
  assert.throws(() => new SupabasePublicCache('http://test.supabase.co', 'sb_secret_test'));
});
