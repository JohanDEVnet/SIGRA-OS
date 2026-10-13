import { IGP_BASE, WEATHER_BASE, parseIGP, parseWeather } from './provider-parsers.js';
import type { PublicEvent, Weather } from './provider-parsers.js';
import { INAIGEM_URL, SENAMHI_URL, parseLakes, parseStations } from './inventories.js';
import type { InventoryPoint } from './inventories.js';
import { PopulationAdapter, POPULATION_CKAN_URL } from './population.js';
import type { Population } from './population.js';
import { GeographyAdapter, DISTRICT_WFS_BASE } from './geography.js';
import type { DistrictResolution } from './geography.js';
import { ProviderTransport } from './transport.js';
import type { ProviderState, TransportOptions, ProviderEnvelope } from './transport.js';
import { createSupabaseCacheFromEnv } from './persistent-cache.js';
import { LocalitiesAdapter } from './localities.js';
import { eventCacheCodec } from './event-cache-codec.js';
export { IGP_BASE, WEATHER_BASE, parseIGP, parseWeather };
export type { PublicEvent, Weather, Population, DistrictResolution };
export type { ProviderMetadata as Metadata, ProviderEnvelope as Envelope, ProviderState as SourceState } from './transport.js';
export const PROVIDER_TTL_MS = { IGP: 300_000, SENAMHI: 900_000, INAIGEM: 86_400_000, 'Open-Meteo': 1_800_000, 'PCM / RENIEC': 604_800_000 } as const;
export class PublicProviders {
  readonly transport: ProviderTransport;
  private populationAdapter: PopulationAdapter;
  private geographyAdapter: GeographyAdapter;
  private localitiesAdapter: LocalitiesAdapter;
  constructor(fetcher: typeof fetch = fetch, private now: () => number = Date.now, private ttlOverrideMs?: number, options: TransportOptions = {}) {
    let persistentStore = options.persistentStore;
    let persistenceConfigurationError = options.persistenceConfigurationError;
    if (persistentStore === undefined) {
      try {
        persistentStore = createSupabaseCacheFromEnv();
      } catch (error) {
        persistentStore = null;
        persistenceConfigurationError = error instanceof Error ? error.message : 'Configuración Supabase inválida.';
      }
    }
    this.transport = new ProviderTransport(fetcher, now, { ...options, persistentStore, persistenceConfigurationError });
    this.populationAdapter = new PopulationAdapter(this.transport, now);
    this.geographyAdapter = new GeographyAdapter(this.transport);
    this.localitiesAdapter = new LocalitiesAdapter(this.transport);
  }
  sourceStates(): ProviderState[] {
    const definitions = [
      { id: 'IGP', name: 'Instituto Geofísico del Perú', sourceUrl: `${IGP_BASE}${new Date(this.now()).getUTCFullYear()}` },
      { id: 'Open-Meteo', name: 'Open-Meteo', sourceUrl: WEATHER_BASE },
      { id: 'SENAMHI', name: 'SENAMHI', sourceUrl: SENAMHI_URL },
      { id: 'INAIGEM', name: 'INAIGEM', sourceUrl: INAIGEM_URL },
      { id: 'PCM / RENIEC', name: 'PCM / RENIEC', sourceUrl: POPULATION_CKAN_URL },
      { id: 'INEI', name: 'INEI · límites distritales referenciales', sourceUrl: DISTRICT_WFS_BASE },
    ];
    return definitions.map((source): ProviderState => this.transport.states.get(source.id) ?? { ...source, status: 'not-queried', lastChecked: null, lastSuccess: null, detail: 'Adaptador disponible; aún no se ha consultado durante esta ejecución.' });
  }
  async igp(year: number): Promise<ProviderEnvelope<PublicEvent[]>> {
    return this.transport.json(`IGP:${year}`, 'IGP', `${IGP_BASE}${year}`, this.ttlOverrideMs ?? PROVIDER_TTL_MS.IGP, (input) => { const result = parseIGP(input); return { ...result, dateOfData: result.data[0]?.date ?? null }; }, eventCacheCodec(year));
  }
  async stations(): Promise<ProviderEnvelope<InventoryPoint[]>> { return this.transport.json('stations', 'SENAMHI', SENAMHI_URL, this.ttlOverrideMs ?? PROVIDER_TTL_MS.SENAMHI, parseStations); }
  async lakes(): Promise<ProviderEnvelope<InventoryPoint[]>> { return this.transport.json('lakes', 'INAIGEM', INAIGEM_URL, this.ttlOverrideMs ?? PROVIDER_TTL_MS.INAIGEM, parseLakes); }
  async weather(lat: number, lon: number): Promise<ProviderEnvelope<Weather>> {
    const url = new URL(WEATHER_BASE);
    url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: 'temperature_2m,precipitation,wind_speed_10m', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm', timezone: 'UTC' }).toString();
    return this.transport.json(`weather:${lat}:${lon}`, 'Open-Meteo', url.href, this.ttlOverrideMs ?? PROVIDER_TTL_MS['Open-Meteo'], (input) => { const result = parseWeather(input); return { ...result, dateOfData: result.data.time }; });
  }
  async realPopulation(ubigeo: string): Promise<ProviderEnvelope<Population>> { return this.populationAdapter.realPopulation(ubigeo); }
  async resolveDistrict(lat: number, lon: number): Promise<ProviderEnvelope<DistrictResolution>> { return this.geographyAdapter.resolveDistrict(lat, lon); }
  async searchLocalities(q: string, limit = 10) { return this.localitiesAdapter.search(q, limit); }
}
