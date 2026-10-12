export interface QuakeEvent { id:string; date:string; lat:number; lon:number; magnitude:number; depth:number; reference:string; district:string; province:string; region:string; ubigeo:string; population:number; lakes:number; stations:number; precipitation:number }
export interface Factor {id:string;name:string;score:number;weight:number;contribution:number;available:boolean;source:string}
export interface Panorama {event:QuakeEvent;index:number|null;level:string;partial:boolean;factors:Factor[];warnings:string[];radiusKm:number}
export const services = [
 {id:'SIG-01',name:'Actividad sísmica',provider:'IGP',route:'/api/v1/sismos',protocol:'REST · JSON',ttl:'5 min',kind:'Atómico'},
 {id:'SIG-02',name:'Estaciones hidrológicas',provider:'SENAMHI',route:'/api/v1/hidrologia/estaciones',protocol:'OGC WFS',ttl:'15 min',kind:'Atómico'},
 {id:'SIG-03',name:'Lagunas glaciares',provider:'INAIGEM',route:'/api/v1/glaciares/lagunas',protocol:'ArcGIS REST',ttl:'24 h',kind:'Atómico'},
 {id:'SIG-04',name:'Exposición poblacional',provider:'PCM / RENIEC',route:'/api/v1/poblacion/{ubigeo}',protocol:'CKAN · CSV',ttl:'7 días',kind:'Atómico'},
 {id:'SIG-05',name:'Contexto meteorológico',provider:'Open-Meteo',route:'/api/v1/meteorologia/actual',protocol:'REST · JSON',ttl:'30 min',kind:'Utilidad'},
 {id:'SIG-06',name:'Panorama de riesgo',provider:'SIGRA',route:'/api/v1/riesgo/panorama',protocol:'REST · JSON',ttl:'Por consulta',kind:'Compuesto'},
 {id:'SIG-07',name:'Inventario de servicios',provider:'SIGRA',route:'/api/v1/catalogo/servicios',protocol:'REST · JSON',ttl:'Estático',kind:'Catálogo'},
 {id:'SIG-08',name:'Contrato SOAP',provider:'SUNAT',route:'/api/v1/catalogo/contrato-soap',protocol:'SOAP · WSDL',ttl:'Referencia',kind:'Catálogo'},
 {id:'SIG-09',name:'Contrato WFS',provider:'SENAMHI',route:'/api/v1/catalogo/contrato-wfs',protocol:'OGC WFS',ttl:'Referencia',kind:'Catálogo'}
];
const clamp=(n:number)=>Math.min(100,Math.max(0,n));
export function calculatePanorama(event:QuakeEvent, missingSources:string[]=[]):Panorama {
 const value=(source:string,n:number)=>missingSources.includes(source)?null:n;
 const result=calculateRisk({magnitude:value('IGP',event.magnitude),depth:value('IGP',event.depth),lakes:value('INAIGEM',event.lakes),stations:value('SENAMHI',event.stations),population:value('PCM / RENIEC',event.population),precipitation:value('Open-Meteo',event.precipitation)});
 return {...result,event,factors:result.factors.map(f=>({...f,score:f.score??0,contribution:f.contribution??0})),radiusKm:influenceRadiusKm(event.magnitude)};
}


export interface RiskInputs { magnitude:number|null; depth:number|null; lakes:number|null; stations:number|null; population:number|null; precipitation:number|null }
export interface RiskFactor { id:string; name:string; source:string; score:number|null; baseWeight:number; weight:number; contribution:number|null; available:boolean }
export interface RiskResult { index:number|null; level:string; partial:boolean; factors:RiskFactor[]; warnings:string[] }
/** Ecuación verificada en m:oMath del Word original, con límites de 10–150 km. */
export function influenceRadiusKm(magnitude:number):number {
 if(!Number.isFinite(magnitude)||magnitude<0||magnitude>10)throw new RangeError('Magnitud fuera de rango.');
 return Math.round(Math.min(150,Math.max(10,10**(.4*magnitude-.8)))*10)/10;
}
/** Cada null representa una fuente ausente; cero conserva su significado real. */
export function calculateRisk(inputs:RiskInputs,degradedSources:string[]=[]):RiskResult {
 const valid=(n:number|null)=>n!==null&&Number.isFinite(n)&&n>=0;
 const seeds=[
  {id:'F1',name:'Sísmico',source:'IGP',baseWeight:.30,score:valid(inputs.magnitude)&&valid(inputs.depth)?clamp((inputs.magnitude!-3)/4*100)*(inputs.depth!<60?1:inputs.depth!<=300?.7:.4):null},
  {id:'F2',name:'Glaciar',source:'INAIGEM',baseWeight:.20,score:valid(inputs.lakes)?clamp(25*inputs.lakes!):null},
  {id:'F3',name:'Hidrológico',source:'SENAMHI',baseWeight:.15,score:valid(inputs.stations)?clamp(20*inputs.stations!):null},
  {id:'F4',name:'Poblacional',source:'PCM / RENIEC',baseWeight:.25,score:valid(inputs.population)?clamp(100*Math.log10(Math.max(1,inputs.population!))/6):null},
  {id:'F5',name:'Meteorológico',source:'Open-Meteo',baseWeight:.10,score:valid(inputs.precipitation)?clamp(10*inputs.precipitation!):null},
 ];
 const missing=seeds.filter(f=>f.score===null);const cannotCalculate=seeds[0].score===null||missing.length>=2;
 const availableWeight=seeds.filter(f=>f.score!==null).reduce((sum,f)=>sum+f.baseWeight,0);
 const factors=seeds.map(f=>{const available=f.score!==null;const weight=available&&!cannotCalculate?f.baseWeight/availableWeight:f.baseWeight;return {...f,available,weight,contribution:available&&!cannotCalculate?f.score!*weight:null};});
 const index=cannotCalculate?null:Math.round(factors.reduce((sum,f)=>sum+(f.contribution??0),0)*10)/10;
 const warnings=missing.map(f=>`Fuente ${f.source} no disponible para el cálculo.`);
 if(cannotCalculate)warnings.push('No hay datos suficientes para calcular el índice.');
 else if(missing.length===1)warnings.push('Índice parcial: se redistribuyeron proporcionalmente los pesos de los factores disponibles.');
 for(const source of new Set(degradedSources))warnings.push(`${source}: se utilizó una consulta real guardada; comprueba su fecha.`);
 return {index,level:index===null?'Sin cálculo':index<25?'Bajo':index<50?'Moderado':index<75?'Alto':'Muy alto',partial:missing.length>0||degradedSources.length>0,factors,warnings};
}
