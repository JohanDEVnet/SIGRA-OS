import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PanoramaService } from '../src/panorama.js';
import { parseIGP, PublicProviders } from '../src/providers.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/igp-real.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const event=parseIGP(fixture.records).data[0];
const meta=(source:string,status:'ok'|'degraded'='ok')=>({source,sourceUrl:'https://example.test/'+source,obtainedAt:'2026-10-11T23:00:00.000Z',status,fromCache:status==='degraded',warnings:status==='degraded'?['Consulta guardada.']:[]});
function providers(fail:string[]=[],degraded:string[]=[]) {
 const result=async<T>(id:string,data:T)=>{if(fail.includes(id))throw new ServiceUnavailableException(id+' no disponible.');return {data,meta:meta(id,degraded.includes(id)?'degraded':'ok')};};
 return {
  igp:()=>result('IGP',[event]),
  lakes:()=>result('INAIGEM',[{id:'lake-test',name:'Punto controlado',lat:event.lat,lon:event.lon,region:null},{id:'far',name:'Fuera del radio',lat:0,lon:0,region:null}]),
  stations:()=>result('SENAMHI',[{id:'station-test',name:'Punto controlado',lat:event.lat,lon:event.lon,region:null}]),
  weather:()=>result('Open-Meteo',{temperature:12,precipitation:2,wind:1,time:'2026-10-11T23:00:00Z',lat:event.lat,lon:event.lon}),
  resolveDistrict:()=>result('INEI',{ubigeo:'050701',district:'Coracora',province:null,region:null,method:'nearest' as const,distanceKm:4}),
  // Entrada controlada exclusiva para comprobar composición, no fallback de producción.
  realPopulation:()=>result('PCM / RENIEC',{ubigeo:'050701',district:'Coracora',province:'Parinacochas',region:'Ayacucho',population:45000,fecha_corte:'2026-06-30',measure:'identified_dni',resourceUrl:'https://example.test/population'}),
 } as unknown as PublicProviders;
}
test('orquestación correlaciona por radio, conserva procedencia, completa ubicación y traza',async()=>{
 const result=await new PanoramaService(providers()).compose({eventId:event.id,days:7,minMagnitude:4});
 assert.equal(result.data.event.id,event.id);assert.equal(result.data.radiusKm,10);assert.deepEqual(result.data.counts,{lakes:1,stations:1});
 assert.equal(result.data.district?.ubigeo,'050701');assert.equal(result.data.district?.province,'Parinacochas');assert.equal(result.data.population?.measure,'identified_dni');
 assert.equal(result.data.partial,false);assert.notEqual(result.data.index,null);assert.equal(result.data.sources.length,6);assert.equal(result.data.trace.steps.length,6);assert.ok(result.data.warnings.some(w=>w.includes('más cercano')));
});
test('una fuente ausente deja null real, redistribuye pesos y marca índice parcial',async()=>{
 const result=await new PanoramaService(providers(['INAIGEM'])).compose({eventId:event.id,days:7,minMagnitude:4});
 assert.equal(result.data.counts.lakes,null);assert.equal(result.data.partial,true);assert.notEqual(result.data.index,null);
 assert.equal(result.data.factors.find(f=>f.id==='F2')?.score,null);assert.ok(Math.abs(result.data.factors.filter(f=>f.available).reduce((sum,f)=>sum+f.weight,0)-1)<1e-10);
});
test('dos fuentes ausentes suspenden cálculo; caché degradada nunca se marca completa',async()=>{
 const result=await new PanoramaService(providers(['INAIGEM','Open-Meteo'])).compose({eventId:event.id,days:7,minMagnitude:4});
 assert.equal(result.data.index,null);assert.equal(result.data.level,'Sin cálculo');assert.equal(result.data.factors[0].contribution,null);
 const cached=await new PanoramaService(providers([],['SENAMHI'])).compose({eventId:event.id,days:7,minMagnitude:4});assert.equal(cached.meta.status,'degraded');assert.equal(cached.data.partial,true);assert.equal(cached.data.sources.find(s=>s.id==='SENAMHI')?.obtainedAt,'2026-10-11T23:00:00.000Z');
});
test('sin ubigeo oficial no consulta población ni inventa habitantes',async()=>{
 const p=providers(['INEI']);p.realPopulation=async()=>{throw new Error('No debe ejecutarse.');};
 const result=await new PanoramaService(p).compose({eventId:event.id,days:7,minMagnitude:4});assert.equal(result.data.district,null);assert.equal(result.data.population,null);assert.equal(result.data.factors.find(f=>f.id==='F4')?.available,false);
});
test('sin IGP no inicia análisis; evento inexistente devuelve404',async()=>{
 await assert.rejects(()=>new PanoramaService(providers(['IGP'])).compose({eventId:event.id,days:7,minMagnitude:4}),ServiceUnavailableException);
 await assert.rejects(()=>new PanoramaService(providers()).compose({eventId:'2026-9999',days:7,minMagnitude:4}),NotFoundException);
});
