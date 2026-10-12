import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProviderTransport } from './transport.js';
import type { ProviderEnvelope, Parsed } from './transport.js';
import type { PersistenceCodec } from './persistent-cache.js';
export const POPULATION_DATASET_ID = 'b5dd9950-3cc2-401a-b129-81b896d24513';
export const POPULATION_CKAN_URL = `https://www.datosabiertos.gob.pe/api/3/action/package_show?id=${POPULATION_DATASET_ID}`;
export interface Population { ubigeo: string; district: string; province: string; region: string; population: number; fecha_corte: string; measure: 'identified_dni'; resourceUrl: string }
export interface PopulationResource { url: string; id: string; name: string; dateOfData: string; dateBasis: 'quarter_label' }
function officialCsvUrl(input: unknown): string {
  if (typeof input !== 'string') throw new Error('Recurso poblacional sin URL.');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || !['www.datosabiertos.gob.pe','datosabiertos.gob.pe'].includes(url.hostname) || !url.pathname.startsWith('/sites/default/files/') || !url.pathname.toLowerCase().endsWith('.csv')) throw new Error('URL del recurso CSV fuera del portal oficial.');
  return url.href;
}
function cutoff(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-(03-31|06-30|09-30|12-31)$/.test(value); }
const resourceCodec: PersistenceCodec<PopulationResource> = {
  encode: (data) => data,
  decode(input) {
    if (!input || typeof input !== 'object') throw new Error('Descriptor persistente inválido.');
    const row = input as PopulationResource;
    if (typeof row.id !== 'string' || !/^[a-f\d-]{36}$/i.test(row.id) || typeof row.name !== 'string' || !cutoff(row.dateOfData) || row.dateBasis !== 'quarter_label') throw new Error('Descriptor persistente incompleto.');
    return { ...row, url: officialCsvUrl(row.url) };
  },
};
function populationCodec(resource: PopulationResource): PersistenceCodec<Map<string, Population>> {
  return {
    encode: (data) => [...data.values()],
    decode(input) {
      if (!Array.isArray(input) || !input.length || input.length > 2500) throw new Error('Agregado persistente incompleto.');
      const result = new Map<string, Population>();
      for (const row of input) {
        if (!row || typeof row !== 'object' || typeof row.ubigeo !== 'string' || !/^\d{6}$/.test(row.ubigeo) || row.ubigeo.startsWith('00') || result.has(row.ubigeo) || !Number.isSafeInteger(row.population) || row.population < 0 || row.measure !== 'identified_dni' || row.fecha_corte !== resource.dateOfData || row.resourceUrl !== resource.url || ![row.district, row.province, row.region].every(value => typeof value === 'string' && value.trim().length > 0 && value.length < 200)) throw new Error('Agregado poblacional persistente inválido.');
        result.set(row.ubigeo, { ubigeo: row.ubigeo, district: row.district, province: row.province, region: row.region, population: row.population, fecha_corte: row.fecha_corte, measure: 'identified_dni', resourceUrl: officialCsvUrl(row.resourceUrl) });
      }
      return result;
    },
  };
}
export function selectPopulationResource(input: unknown, now = Date.now()): Parsed<PopulationResource> {
  if (!input || typeof input !== 'object' || !(input as { success?: unknown }).success) throw new Error('Respuesta CKAN no válida.');
  const result = (input as { result?: unknown }).result;
  const dataset = Array.isArray(result) ? result.find((item) => item?.id === POPULATION_DATASET_ID) : result;
  if (!dataset || typeof dataset !== 'object' || !Array.isArray(dataset.resources)) throw new Error('CKAN no publicó recursos del conjunto RENIEC.');
  const resources: PopulationResource[] = [];
  for (const resource of dataset.resources) {
    if (typeof resource?.name !== 'string' || String(resource.format).toLowerCase() !== 'csv' || typeof resource.url !== 'string') continue;
    const match = resource.name.match(/Reporte\s+(IV|III|II|I)\s+Trimestre\s+(\d{4})/i);
    if (!match) continue;
    const quarter = ['I','II','III','IV'].indexOf(match[1].toUpperCase()) + 1;
    const cut = new Date(Date.UTC(Number(match[2]), quarter * 3, 0));
    if (cut.getTime() > now) continue;
    resources.push({ url: officialCsvUrl(resource.url), id: String(resource.id), name: resource.name, dateOfData: cut.toISOString().slice(0, 10), dateBasis: 'quarter_label' });
  }
  resources.sort((a, b) => b.dateOfData.localeCompare(a.dateOfData));
  if (!resources.length) throw new Error('CKAN no publicó un recurso trimestral CSV verificable.');
  return { data: resources[0], dateOfData: resources[0].dateOfData, warnings: ['La fecha de corte corresponde al cierre del trimestre declarado en el nombre del recurso RENIEC; el CSV no contiene una columna individual de fecha de corte.'] };
}

export async function* csvRows(chunks: AsyncIterable<string>): AsyncGenerator<string[]> {
  let row: string[] = []; let field = ''; let quoted = false; let afterQuote = false; let first = true;
  for await (let chunk of chunks) {
    if (first) { chunk = chunk.replace(/^\uFEFF/, ''); first = false; }
    for (const char of chunk) {
      if (quoted) {
        if (afterQuote) {
          if (char === '"') { field += '"'; afterQuote = false; continue; }
          quoted = false; afterQuote = false;
          if (![',','\r','\n'].includes(char)) throw new Error('CSV con comillas mal cerradas.');
        } else { if (char === '"') afterQuote = true; else field += char; continue; }
      }
      if (char === '"') { if (field) throw new Error('CSV con comillas en un campo sin escape.'); quoted = true; }
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n') { row.push(field); field = ''; if (row.some((item) => item !== '')) yield row; row = []; }
      else if (char !== '\r') field += char;
      if (field.length > 10_000 || row.length > 100) throw new Error('Campo CSV excede el límite de tamaño.');
    }
  }
  if (quoted && !afterQuote) throw new Error('CSV truncado dentro de un campo citado.');
  if (field || row.length) { row.push(field); if (row.some((item) => item !== '')) yield row; }
}
async function* responseChunks(response: Response): AsyncGenerator<string> {
  if (!response.body) throw new Error('CSV sin cuerpo.');
  const reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let bytes = 0;
  try {
    for (;;) { const result = await reader.read(); if (result.done) break; bytes += result.value.byteLength; if (bytes > 150_000_000) throw new Error('CSV excede el tamaño permitido.'); yield decoder.decode(result.value, { stream: true }); }
    const rest = decoder.decode(); if (rest) yield rest;
  } finally { reader.releaseLock(); }
}
export async function aggregatePopulation(chunks: AsyncIterable<string>, resource: PopulationResource): Promise<Parsed<Map<string, Population>>> {
  let header: string[] | undefined; const populations = new Map<string, Population>(); const groups = new Set<string>();
  for await (const fields of csvRows(chunks)) {
    if (!header) {
      header = fields.map((field) => field.trim().toUpperCase());
      for (const name of ['RESIDENCIA','UBIGEO_INEI','DEPARTAMENTO','PROVINCIA','DISTRITO','TIPODNI','SEXO','EDAD','CANTIDAD']) if (!header.includes(name)) throw new Error(`Falta columna CSV ${name}.`);
      continue;
    }
    if (fields.length !== header.length) throw new Error('Fila CSV incompleta o truncada.');
    const get = (name: string) => fields[header!.indexOf(name)].trim();
    if (get('RESIDENCIA').toLowerCase() !== 'nacional') continue;
    const ubigeo = get('UBIGEO_INEI').padStart(6, '0');
    if (!/^\d{6}$/.test(ubigeo) || ubigeo.startsWith('00') || !/^\d+$/.test(get('CANTIDAD'))) throw new Error('Ubigeo o cantidad CSV inválidos.');
    const quantity = Number(get('CANTIDAD'));
    if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Cantidad CSV fuera de rango.');
    const dimensionKey = [ubigeo, get('TIPODNI'), get('SEXO'), get('EDAD')].join('|');
    if (groups.has(dimensionKey)) throw new Error('Grupo estadístico CSV duplicado; la suma no sería verificable.');
    groups.add(dimensionKey);
    const district = get('DISTRITO'); const province = get('PROVINCIA'); const region = get('DEPARTAMENTO');
    if (!district || !province || !region) throw new Error('Nombres administrativos CSV ausentes.');
    const existing = populations.get(ubigeo);
    if (existing && (existing.district !== district || existing.province !== province || existing.region !== region)) throw new Error('Ubigeo con nombres administrativos contradictorios.');
    const total = (existing?.population ?? 0) + quantity;
    if (!Number.isSafeInteger(total)) throw new Error('Suma poblacional fuera de rango.');
    populations.set(ubigeo, { ubigeo, district, province, region, population: total, fecha_corte: resource.dateOfData, measure: 'identified_dni', resourceUrl: resource.url });
  }
  if (!header || !populations.size) throw new Error('El CSV no contiene población nacional por ubigeo.');
  return { data: populations, dateOfData: resource.dateOfData, warnings: ['Población identificada con DNI por residencia RENIEC; no equivale a población censada ni a personas afectadas. Se suman grupos distintos de tipo de DNI, sexo y edad usando UBIGEO_INEI.','Fecha de corte derivada del cierre del trimestre declarado en el recurso RENIEC; no es la fecha de descarga.'] };
}
export class PopulationAdapter {
  constructor(private transport: ProviderTransport, private now: () => number = Date.now) {}
  async realPopulation(ubigeo: string): Promise<ProviderEnvelope<Population>> {
    if (!/^\d{6}$/.test(ubigeo)) throw new BadRequestException('El ubigeo INEI debe tener seis dígitos.');
    const descriptor = await this.transport.json('population:descriptor', 'PCM / RENIEC', POPULATION_CKAN_URL, 604_800_000, (input) => selectPopulationResource(input, this.now()), resourceCodec);
    const resource = descriptor.data;
    const response = await this.transport.load(`population:csv:${resource.id}`, 'PCM / RENIEC', resource.url, 604_800_000, (raw) => aggregatePopulation(responseChunks(raw), resource), populationCodec(resource));
    const data = response.data.get(ubigeo);
    if (!data) throw new NotFoundException({ statusCode: 404, message: 'El ubigeo no existe en el recurso poblacional RENIEC.', ubigeo, sourceUrl: resource.url, dateOfData: resource.dateOfData });
    const degraded = descriptor.meta.status === 'degraded' || response.meta.status === 'degraded';
    return { data, meta: { ...response.meta, status: degraded ? 'degraded' : 'ok', warnings: [...new Set([...descriptor.meta.warnings, ...response.meta.warnings])], durationMs: (descriptor.meta.durationMs ?? 0) + (response.meta.durationMs ?? 0), datasetDistrictCount: response.data.size } };
  }
}
