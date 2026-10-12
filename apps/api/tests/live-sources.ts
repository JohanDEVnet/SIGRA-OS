import { PublicProviders } from '../src/providers.js';
const providers = new PublicProviders();
for (const [name, run] of [
  ['district-huaraz', () => providers.resolveDistrict(-9.53, -77.53)],
  ['district-offshore-quilca', () => providers.resolveDistrict(-16.78, -72.56)],
  ['population-huaraz', () => providers.realPopulation('020101')],
  ['population-coracora', () => providers.realPopulation('050701')],
] as const) {
  try { const response = await run(); console.log(JSON.stringify({ name, data: response.data, meta: response.meta })); }
  catch (error) { console.error(name, error); process.exitCode = 1; }
}
