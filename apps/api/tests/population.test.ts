import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { aggregatePopulation, csvRows, PopulationAdapter, selectPopulationResource } from '../src/population.js';
import { ProviderTransport } from '../src/transport.js';
const descriptor = JSON.parse(readFileSync(new URL('./fixtures/population-ckan-real.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const csv = readFileSync(new URL('./fixtures/population-huaraz-real.csv', import.meta.url), 'utf8');
const source = selectPopulationResource(descriptor, Date.parse('2026-10-12')).data;
async function* chunks(input: string) { for (let index = 0; index < input.length; index += 71) yield input.slice(index, index + 71); }
test('CKAN real result-array: selecciona último trimestre y conserva fecha de corte declarada', () => {
  assert.equal(source.id, '20c1ee2d-67f0-46fd-8cde-f301ee87aa46');
  assert.equal(source.dateOfData, '2026-06-30');
  assert.equal(source.dateBasis, 'quarter_label');
  assert.match(source.url, /2026_06\.01\.csv$/);
  assert.throws(() => selectPopulationResource({ success: false }));
});
test('CSV real Huaraz: agrega sexo, edades y tipos DNI por UBIGEO_INEI', async () => {
  const response = await aggregatePopulation(chunks(csv), source);
  assert.equal(response.data.size, 1);
  const huaraz = response.data.get('020101')!;
  assert.equal(huaraz.population, 70074);
  assert.equal(huaraz.district, 'Huaraz');
  assert.equal(huaraz.region, 'Áncash');
  assert.equal(huaraz.measure, 'identified_dni');
  assert.equal(huaraz.fecha_corte, '2026-06-30');
  assert.match(response.warnings[0], /no equivale a población censada/);
});
test('CSV soporta comillas escapadas y filas citadas partidas entre chunks', async () => {
  const result: string[][] = [];
  for await (const row of csvRows(chunks('\uFEFFa,b\r\n"un, campo","texto ""citado""\ny dividido"\r\n'))) result.push(row);
  assert.deepEqual(result, [['a','b'],['un, campo','texto "citado"\ny dividido']]);
  await assert.rejects(async () => { for await (const row of csvRows(chunks('a,b\n"truncado'))) void row; });
});
test('rechaza datos incompletos y no duplica grupos estadísticos', async () => {
  await assert.rejects(aggregatePopulation(chunks('UBIGEO,CANTIDAD\n020101,1'), source));
  const lines = csv.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  await assert.rejects(aggregatePopulation(chunks(`${lines[0]}\n${lines[1]}\n${lines[1]}`), source), /duplicado/);
  await assert.rejects(aggregatePopulation(chunks(`${lines[0]}\n${lines[1].replace(/,132$/, ',NaN')}`), source));
});
test('adaptador consulta descriptor+CSV una vez, reusa caché 7d y devuelve 404/400 correctos', async () => {
  let calls = 0;
  const transport = new ProviderTransport(async (url) => { calls++; return new Response(String(url).includes('package_show') ? JSON.stringify(descriptor) : csv); }, () => Date.parse('2026-10-12'), { retries: 0 });
  const adapter = new PopulationAdapter(transport, () => Date.parse('2026-10-12'));
  assert.equal((await adapter.realPopulation('020101')).data.population, 70074);
  assert.equal((await adapter.realPopulation('020101')).meta.fromCache, true);
  assert.equal(calls, 2);
  await assert.rejects(adapter.realPopulation('000001'), NotFoundException);
  await assert.rejects(adapter.realPopulation('20101'), BadRequestException);
});
