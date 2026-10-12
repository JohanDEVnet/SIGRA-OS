import { GatewayTimeoutException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { calculateRisk, influenceRadiusKm } from '@sigra/domain';
import type { RiskFactor } from '@sigra/domain';
import { distanceKm, INAIGEM_URL, SENAMHI_URL } from './inventories.js';
import { IGP_BASE, WEATHER_BASE, PublicProviders } from './providers.js';
import type { Envelope, PublicEvent } from './providers.js';

export interface DistrictData { ubigeo:string; district:string; province:string|null; region:string|null; method:'contains'|'nearest'; distanceKm:number; sourceUrl:string; obtainedAt:string }
export interface PopulationData { ubigeo:string; district:string; province:string|null; region:string|null; inhabitants:number; referenceDate:string; measure:string; sourceUrl:string }
export interface PanoramaSource { id:string; status:'ok'|'degraded'|'unavailable'; obtainedAt:string|null; dateOfData:string|null; sourceUrl:string; warnings:string[]; durationMs:number; fromCache:boolean }
export interface PanoramaData {
 event:PublicEvent; district:DistrictData|null; population:PopulationData|null; radiusKm:number;
 counts:{lakes:number|null;stations:number|null}; index:number|null; level:string; partial:boolean; factors:RiskFactor[];
 sources:PanoramaSource[]; warnings:string[];
 trace:{id:string;totalMs:number;steps:{source:string;status:string;durationMs:number}[]};
}
export interface PanoramaQuery { eventId?:string; days:number; minMagnitude:number; radiusKm?:number }
/** Orquestación del Word: evento → consultas concurrentes → correlación → índice. */
export class PanoramaService {
 constructor(private providers:PublicProviders) {}
 async compose(query:PanoramaQuery):Promise<Envelope<PanoramaData>> {
  const started=Date.now();const deadline=started+85_000;const traceId=randomUUID();const sources:PanoramaSource[]=[];
  const capture=async<T>(id:string,url:string,work:()=>Promise<Envelope<T>>):Promise<Envelope<T>|null>=>{
   const begin=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;
   try {
    const response=await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new GatewayTimeoutException('Se agotó el tiempo de la consulta compuesta.')),Math.max(1,deadline-Date.now()));})]);
    sources.push({id,status:response.meta.status,obtainedAt:response.meta.obtainedAt,dateOfData:response.meta.dateOfData??null,sourceUrl:response.meta.sourceUrl,warnings:[...response.meta.warnings],durationMs:Date.now()-begin,fromCache:response.meta.fromCache});
    return response;
   } catch(error) {
    const message=error instanceof Error?error.message:'Fuente no disponible.';
    sources.push({id,status:'unavailable',obtainedAt:null,dateOfData:null,sourceUrl:url,warnings:[message],durationMs:Date.now()-begin,fromCache:false});
    return null;
   } finally {if(timer)clearTimeout(timer);}
  };
  const year=query.eventId?Number(query.eventId.slice(0,4)):new Date().getUTCFullYear();
  const feed=await capture('IGP',`${IGP_BASE}${year}`,()=>this.providers.igp(year));
  if(!feed)throw new ServiceUnavailableException({statusCode:503,message:'No se puede iniciar el análisis: el IGP no está disponible.',index:null,sources,traceId});
  const event=query.eventId?feed.data.find(e=>e.id===query.eventId):feed.data.find(e=>e.magnitude>=query.minMagnitude&&Date.parse(e.date)>=started-query.days*86_400_000);
  if(!event)throw new NotFoundException('No se encontró un sismo para la consulta.');
  const igpSource=sources.find(source=>source.id==='IGP');if(igpSource)igpSource.dateOfData=event.date;
  const radiusKm=query.radiusKm??influenceRadiusKm(event.magnitude);
  // La población depende del ubigeo; su cadena se ejecuta junto con las otras tres fuentes.
  const populationWork=async()=>{
   const location=await capture('INEI · distritos','https://geoespacial.inei.gob.pe/geoserver/Interoperabilidad/ows',()=>this.providers.resolveDistrict(event.lat,event.lon));
   if(!location){sources.push({id:'PCM / RENIEC',status:'unavailable',obtainedAt:null,dateOfData:null,sourceUrl:'https://www.datosabiertos.gob.pe/',warnings:['No se pudo identificar un ubigeo oficial para consultar la población.'],durationMs:0,fromCache:false});return {location:null,population:null};}
   const population=await capture('PCM / RENIEC','https://www.datosabiertos.gob.pe/',()=>this.providers.realPopulation(location.data.ubigeo));
   return {location,population};
  };
  const [lakes,stations,weather,demography]=await Promise.all([
   capture('INAIGEM',INAIGEM_URL,()=>this.providers.lakes()),
   capture('SENAMHI',SENAMHI_URL,()=>this.providers.stations()),
   capture('Open-Meteo',WEATHER_BASE,()=>this.providers.weather(event.lat,event.lon)),
   populationWork(),
  ]);
  const counts={lakes:lakes?lakes.data.filter(p=>distanceKm(event.lat,event.lon,p)<=radiusKm).length:null,stations:stations?stations.data.filter(p=>distanceKm(event.lat,event.lon,p)<=radiusKm).length:null};
  const population=demography.population;
  const risk=calculateRisk({magnitude:event.magnitude,depth:event.depth,lakes:counts.lakes,stations:counts.stations,population:population?.data.population??null,precipitation:weather?.data.precipitation??null},sources.filter(s=>s.status==='degraded').map(s=>s.id));
  const location=demography.location;
  const district:DistrictData|null=location?{ubigeo:location.data.ubigeo,district:population?.data.district??location.data.district,province:population?.data.province??location.data.province,region:population?.data.region??location.data.region,method:location.data.method,distanceKm:location.data.distanceKm,sourceUrl:location.meta.sourceUrl,obtainedAt:location.meta.obtainedAt}:null;
  const populationData:PopulationData|null=population?{ubigeo:population.data.ubigeo,district:population.data.district,province:population.data.province,region:population.data.region,inhabitants:population.data.population,referenceDate:population.data.fecha_corte,measure:population.data.measure,sourceUrl:population.data.resourceUrl}:null;
  const warnings=[...risk.warnings,...sources.flatMap(s=>s.warnings),...(district?.method==='nearest'?[`El epicentro está fuera de un polígono distrital consultado. Se usa el distrito más cercano, a ${district.distanceKm.toFixed(1)} km de su límite; no implica que el sismo ocurriera en ese distrito.`]:[]), 'Índice académico del Word; no es una predicción ni una alerta oficial.'];
  const order=['IGP','INAIGEM','SENAMHI','PCM / RENIEC','Open-Meteo','INEI · distritos'];sources.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  const data:PanoramaData={event,district,population:populationData,radiusKm,counts,...risk,sources,warnings:[...new Set(warnings)],trace:{id:traceId,totalMs:Date.now()-started,steps:sources.map(s=>({source:s.id,status:s.status,durationMs:s.durationMs}))}};
  return {data,meta:{source:'SIGRA · composición de servicios',sourceUrl:'/api/v1/riesgo/panorama',obtainedAt:new Date().toISOString(),status:risk.partial?'degraded':'ok',fromCache:sources.some(s=>s.fromCache),warnings:data.warnings}};
 }
}
