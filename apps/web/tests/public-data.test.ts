import test from 'node:test';
import assert from 'node:assert/strict';
import {getPopulation,getWeatherAt,getWeather} from '../src/public-api.ts';
import type {Envelope,PublicPopulation,CurrentWeather,PublicEvent} from '../src/public-types.ts';

// Actual normalized HTTP responses obtained from the running real-provider API on 2026-10-12.
// These fixtures belong exclusively to tests; the web never substitutes them for provider data.
const populationUrl='https://www.datosabiertos.gob.pe/sites/default/files/BD_DAbiertos_16_OPP_2026_06.01.csv';
const population:Envelope<PublicPopulation>={
 data:{ubigeo:'020101',district:'Huaraz',province:'Huaraz',region:'Áncash',population:70074,fecha_corte:'2026-06-30',measure:'identified_dni',resourceUrl:populationUrl},
 meta:{source:'PCM / RENIEC',sourceUrl:populationUrl,obtainedAt:'2026-10-12T19:51:45.017Z',status:'ok',fromCache:true,dateOfData:'2026-06-30',datasetDistrictCount:1892,cacheLayer:'memory',warnings:['Población identificada con DNI; no equivale a población censada ni a personas afectadas.']},
};
const requested={lat:-9.5704162183,lon:-77.4715369560};
const weather:Envelope<CurrentWeather>={
 data:{temperature:15.2,precipitation:0.1,wind:1.3,time:'2026-10-12T20:30:00.000Z',lat:-9.595781,lon:-77.45645},
 meta:{source:'Open-Meteo',sourceUrl:'https://api.open-meteo.com/v1/forecast?latitude=-9.5704162183&longitude=-77.471536956&current=temperature_2m%2Cprecipitation%2Cwind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=UTC',obtainedAt:'2026-10-12T20:36:00.352Z',status:'ok',fromCache:false,dateOfData:'2026-10-12T20:30:00.000Z',warnings:['Condiciones estimadas por modelos meteorológicos; no son mediciones de una estación local.']},
};

test('clima de un punto conserva la celda real del modelo y la compatibilidad por evento',async context=>{
 const signal=new AbortController().signal;let calls=0;
 context.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;const url=new URL(String(input),'http://localhost');
  assert.equal(url.pathname,'/api/v1/meteorologia/actual');assert.equal(Number(url.searchParams.get('lat')),requested.lat);assert.equal(Number(url.searchParams.get('lon')),requested.lon);assert.equal(init?.signal,signal);
  return new Response(JSON.stringify(weather));
 });
 const point=await getWeatherAt(requested,signal);
 assert.deepEqual(point,weather);assert.notEqual(point.data.lat,requested.lat);assert.notEqual(point.data.lon,requested.lon);
 const event:PublicEvent={...requested,id:'2026-0731',date:'2026-10-11T22:44:46.000Z',magnitude:4,depth:32,reference:'Evento para la selección de coordenadas',region:null,reportUrl:null};
 assert.deepEqual(await getWeather(event,signal),weather);assert.equal(calls,2);
});

test('coordenadas inválidas no provocan una solicitud al proveedor',async context=>{
 const fetchMock=context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(weather)));
 await assert.rejects(getWeatherAt({lat:91,lon:-77},new AbortController().signal),/coordenadas válidas/);
 await assert.rejects(getWeatherAt({lat:-9,lon:NaN},new AbortController().signal),/coordenadas válidas/);
 assert.equal(fetchMock.mock.callCount(),0);
});

test('clima rechaza magnitudes, celda, fecha y procedencia incoherentes',async context=>{
 const cases:[string,(body:Record<string,any>)=>void][]=[
  ['viento negativo',body=>{body.data.wind=-1;}],
  ['coordenada de celda ausente',body=>{delete body.data.lat;}],
  ['fecha local sin UTC',body=>{body.data.time='2026-10-12T20:30:00';}],
  ['fecha metadata distinta',body=>{body.meta.dateOfData='2026-10-12T19:00:00.000Z';}],
  ['proveedor no identificado',body=>{body.meta.source='Otra fuente';}],
 ];
 for(const [name,change] of cases)await context.test(name,async child=>{
  const body=structuredClone(weather);change(body);child.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(body)));
  await assert.rejects(getWeatherAt(requested,new AbortController().signal),/no se pudieron verificar/);
 });
});

test('población real conserva UBIGEO_INEI, medida DNI y corte original de una caché degradada',async context=>{
 const signal=new AbortController().signal;const body=structuredClone(population);body.meta.status='degraded';
 context.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  assert.equal(String(input),'/api/v1/poblacion/020101');assert.equal(init?.signal,signal);return new Response(JSON.stringify(body));
 });
 const result=await getPopulation('020101',signal);
 assert.deepEqual(result,body);assert.equal(result.data.population,70074);assert.equal(result.data.measure,'identified_dni');assert.equal(result.data.fecha_corte,'2026-06-30');assert.equal(result.meta.obtainedAt,population.meta.obtainedAt);assert.equal(result.meta.status,'degraded');
});

test('ubigeos incompletos o rutas introducidas como ubigeo se rechazan antes de consultar',async context=>{
 const fetchMock=context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(population)));
 for(const ubigeo of ['20101','020101/otra','020101?x=1'])await assert.rejects(getPopulation(ubigeo,new AbortController().signal),/seis dígitos/);
 assert.equal(fetchMock.mock.callCount(),0);
});

test('población rechaza identidad, medida, conteos y fechas no verificables',async context=>{
 const cases:[string,Record<string,unknown>][]=[
  ['ubigeo distinto',{ubigeo:'020102'}],
  ['medida de censo equivocada',{measure:'census'}],
  ['cantidad negativa',{population:-1}],
  ['cantidad fraccionaria',{population:70074.1}],
  ['cantidad representada como texto',{population:'70074'}],
  ['cantidad fuera de precisión segura',{population:Number.MAX_SAFE_INTEGER+1}],
  ['fecha imposible',{fecha_corte:'2026-02-30'}],
  ['nombre administrativo ausente',{province:null}],
 ];
 for(const [name,patch] of cases)await context.test(name,async child=>{
  const body={...population,data:{...population.data,...patch}};child.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(body)));
  await assert.rejects(getPopulation('020101',new AbortController().signal),/no se pudo verificar/);
 });
});

test('población exige recurso oficial HTTPS y metadata de la misma fuente y corte',async context=>{
 const cases:[string,(body:Record<string,any>)=>void][]=[
  ['recurso externo',body=>{body.data.resourceUrl='https://example.com/poblacion.csv';body.meta.sourceUrl=body.data.resourceUrl;}],
  ['protocolo inseguro',body=>{body.data.resourceUrl=populationUrl.replace('https:','http:');body.meta.sourceUrl=body.data.resourceUrl;}],
  ['recurso con credenciales',body=>{body.data.resourceUrl=populationUrl.replace('https://','https://user:pass@');body.meta.sourceUrl=body.data.resourceUrl;}],
  ['fuente distinta',body=>{body.meta.source='INEI';}],
  ['enlace metadata distinto',body=>{body.meta.sourceUrl='https://www.datosabiertos.gob.pe/';}],
  ['corte metadata contradictorio',body=>{body.meta.dateOfData='2025-12-31';}],
 ];
 for(const [name,change] of cases)await context.test(name,async child=>{
  const body=structuredClone(population);change(body);child.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify(body)));
  await assert.rejects(getPopulation('020101',new AbortController().signal),/no se pudo verificar/);
 });
});
