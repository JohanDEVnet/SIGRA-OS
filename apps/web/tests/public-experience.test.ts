import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,parsePreferences,reportUrl,sharedReport,savePreferences} from '../src/experience.ts';

test('la distancia usa coordenadas reales y es simétrica',()=>{
 const lima={lat:-12.0464,lon:-77.0428};const huaraz={lat:-9.5278,lon:-77.5283};
 assert.equal(distanceKm(lima,lima),0);assert.ok(distanceKm(lima,huaraz)>280&&distanceKm(lima,huaraz)<290);assert.equal(distanceKm(lima,huaraz),distanceKm(huaraz,lima));
});
test('las preferencias rechazan datos corruptos, rangos inválidos y posiciones del dispositivo',()=>{
 assert.equal(parsePreferences('{broken').days,7);assert.equal(parsePreferences('{"days":1000,"magnitude":"-5","radius":0}').radius,100);
 assert.equal(parsePreferences(JSON.stringify({zone:{kind:'device',label:'Mi casa',lat:-12,lon:-77}})).zone,null);
 assert.equal(parsePreferences(JSON.stringify({zone:{kind:'district',ubigeo:'020101',label:'Huaraz',lat:90,lon:-77}})).zone,null);
});
test('se recuerda una localidad pública con filtros válidos',()=>{
 const preferences=parsePreferences(JSON.stringify({days:30,magnitude:'4',radius:300,zone:{kind:'district',ubigeo:'020101',label:'Huaraz',lat:-9.53,lon:-77.53}}));
 assert.equal(preferences.zone?.ubigeo,'020101');assert.equal(preferences.days,30);assert.equal(preferences.magnitude,'4');
});
test('los enlaces compartidos eliminan parámetros ajenos y apuntan al reporte',()=>{
 const url=reportUrl('https://sigra.example/?token=secret#inicio','2026-0732');
 assert.equal(url,'https://sigra.example/?evento=2026-0732&periodo=90#explorar');assert.equal(sharedReport(url),'2026-0732');assert.equal(sharedReport('https://sigra.example/?evento=%3Cscript%3E'),null);
});
test('guardar preferencias nunca persiste la geolocalización del dispositivo',()=>{
 let stored='';Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem(_key:string,value:string){stored=value;}}});
 savePreferences({days:7,magnitude:'0',search:'',radius:100,zone:{kind:'device',label:'Tu ubicación',lat:-12,lon:-77}});
 assert.equal(JSON.parse(stored).zone,null);Reflect.deleteProperty(globalThis,'localStorage');
});
