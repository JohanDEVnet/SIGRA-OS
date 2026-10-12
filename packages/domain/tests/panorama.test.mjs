import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatePanorama} from '../dist/index.js';
// Caso hipotético del informe, exclusivamente para pruebas de la fórmula.
const events=[{id:'test-formula',date:'2026-01-01T00:00:00Z',lat:-9.53,lon:-77.53,magnitude:6,depth:35,reference:'Caso de prueba',district:'Distrito de prueba',province:'Provincia',region:'Región',ubigeo:'000000',population:45000,lakes:2,stations:3,precipitation:2}];
test('ejemplo del informe: 62.9 con cinco factores',()=>{const p=calculatePanorama(events[0]);assert.equal(p.index,62.9);assert.equal(p.level,'Alto');assert.equal(p.partial,false);assert.ok(Math.abs(p.radiusKm-39.8)<.1);});
test('una fuente ausente redistribuye proporcionalmente sus pesos',()=>{const p=calculatePanorama(events[0],['INAIGEM']);assert.equal(p.partial,true);assert.ok(p.index!==null);assert.equal(p.factors[1].available,false);assert.ok(Math.abs(p.factors.filter(f=>f.available).reduce((s,f)=>s+f.weight,0)-1)<.0001);assert.equal(p.factors[0].weight,.375);});
test('sin evento sísmico no se calcula índice',()=>assert.equal(calculatePanorama(events[0],['IGP']).index,null));
test('dos fuentes ausentes impiden el cálculo',()=>assert.equal(calculatePanorama(events[0],['SENAMHI','Open-Meteo']).index,null));
test('sismos profundos reducen aporte y scores se acotan',()=>{const p=calculatePanorama({...events[0],magnitude:10,depth:301,population:1e9,precipitation:100,lakes:100});assert.equal(p.factors[0].score,40);assert.ok(p.factors.every(f=>f.score>=0&&f.score<=100));});
import {calculateRisk,influenceRadiusKm} from '../dist/index.js';
test('radio verificado del Word está acotado entre10 y150km',()=>{assert.equal(influenceRadiusKm(3.6),10);assert.equal(influenceRadiusKm(6),39.8);assert.equal(influenceRadiusKm(10),150);assert.throws(()=>influenceRadiusKm(NaN),RangeError);});
test('un conteo real cero es válido y una fuente ausente permanece null',()=>{const real=calculateRisk({magnitude:6,depth:35,lakes:0,stations:0,population:45000,precipitation:0});assert.equal(real.partial,false);assert.equal(real.factors[1].score,0);assert.equal(real.factors[1].available,true);const missing=calculateRisk({magnitude:6,depth:35,lakes:null,stations:0,population:45000,precipitation:0});assert.equal(missing.factors[1].score,null);assert.equal(missing.factors[1].available,false);assert.equal(missing.partial,true);});
