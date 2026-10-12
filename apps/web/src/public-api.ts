import type {Envelope,PublicEvent,CurrentWeather,InventoryPoint,PanoramaData,ServiceDefinition,PublicLocality,PublicPopulation,Coordinates} from './public-types';
const apiBase=(import.meta.env?.VITE_API_URL||'').replace(/\/$/,'');
async function get<T>(path:string,signal:AbortSignal):Promise<Envelope<T>> {
 const response=await fetch(`${apiBase}/api/v1/${path}`,{signal}).catch(problem=>{if(signal.aborted)throw signal.reason;if(problem instanceof TypeError)throw new Error('No pudimos conectar con el servicio de SIGRA. Puedes volver a intentarlo.');throw problem;});
 const body=await response.json().catch(()=>null);
 if(!response.ok){if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));throw new Error(Number.isFinite(seconds)&&seconds>0?`Hay muchas consultas en este momento. Vuelve a intentarlo en ${Math.ceil(seconds)} segundos.`:'Hay muchas consultas en este momento. Espera un minuto antes de volver a intentarlo.');}throw new Error(typeof body?.message==='string'?body.message:'No pudimos consultar la fuente en este momento.');}
 if(!body||!Array.isArray(body.meta?.warnings)||!Number.isFinite(Date.parse(body.meta.obtainedAt))||!['ok','degraded'].includes(body.meta.status))throw new Error('La fuente devolvió una respuesta que no podemos verificar.');
 return body;
}
export async function getEvents(days:number,signal:AbortSignal){
 const result=await get<PublicEvent[]>(`sismos?dias=${days}&mag_min=0`,signal);
 if(!Array.isArray(result.data)||result.data.some(e=>!e.id||!Number.isFinite(e.lat)||!Number.isFinite(e.lon)||!Number.isFinite(e.magnitude)||!Number.isFinite(e.depth)||!Number.isFinite(Date.parse(e.date))))throw new Error('No pudimos validar los reportes sísmicos recibidos.');
 return result;
}
const coordinateValid=(point:Coordinates)=>point&&typeof point.lat==='number'&&Number.isFinite(point.lat)&&Math.abs(point.lat)<=90&&typeof point.lon==='number'&&Number.isFinite(point.lon)&&Math.abs(point.lon)<=180;
const utcDateTimeValid=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const dateValid=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
function provenanceValid(meta:Envelope<unknown>['meta'],source:string){return meta.source===source&&typeof meta.sourceUrl==='string'&&typeof meta.fromCache==='boolean'&&meta.warnings.every(warning=>typeof warning==='string');}
export async function getWeatherAt(coordinates:Coordinates,signal:AbortSignal):Promise<Envelope<CurrentWeather>>{
 if(!coordinateValid(coordinates))throw new Error('Elige una ubicación con coordenadas válidas para consultar el tiempo.');
 const query=new URLSearchParams({lat:String(coordinates.lat),lon:String(coordinates.lon)});
 const result=await get<CurrentWeather>(`meteorologia/actual?${query}`,signal);const data=result.data;
 if(!data||!coordinateValid(data)||![data.temperature,data.precipitation,data.wind].every(value=>typeof value==='number'&&Number.isFinite(value))||data.temperature< -100||data.temperature>100||data.precipitation<0||data.precipitation>10000||data.wind<0||data.wind>1000||!utcDateTimeValid(data.time)||!provenanceValid(result.meta,'Open-Meteo')||result.meta.dateOfData!==data.time)throw new Error('Los datos del tiempo no están disponibles o no se pudieron verificar.');
 return result;
}
export function getWeather(event:PublicEvent,signal:AbortSignal){return getWeatherAt(event,signal);}
export async function getPopulation(ubigeo:string,signal:AbortSignal):Promise<Envelope<PublicPopulation>>{
 if(typeof ubigeo!=='string'||!/^\d{6}$/.test(ubigeo))throw new Error('Elige un distrito con ubigeo INEI de seis dígitos para consultar su población.');
 const result=await get<PublicPopulation>(`poblacion/${encodeURIComponent(ubigeo)}`,signal);const data=result.data;
 let resourceValid=false;
 if(typeof data?.resourceUrl==='string')try{const url=new URL(data.resourceUrl);resourceValid=url.protocol==='https:'&&!url.username&&!url.password&&['datosabiertos.gob.pe','www.datosabiertos.gob.pe'].includes(url.hostname)&&url.pathname.startsWith('/sites/default/files/')&&url.pathname.toLowerCase().endsWith('.csv');}catch{/* La URL recibida no pertenece a un recurso verificable. */}
 if(!data||data.ubigeo!==ubigeo||![data.district,data.province,data.region].every(value=>typeof value==='string'&&value.trim().length>0)||!Number.isSafeInteger(data.population)||data.population<0||!dateValid(data.fecha_corte)||data.measure!=='identified_dni'||!resourceValid||!provenanceValid(result.meta,'PCM / RENIEC')||result.meta.sourceUrl!==data.resourceUrl||result.meta.dateOfData!==data.fecha_corte)throw new Error('La población distrital recibida no se pudo verificar.');
 return result;
}
export async function getInventory(kind:'lakes'|'stations',signal:AbortSignal){
 const result=await get<InventoryPoint[]>(kind==='lakes'?'glaciares/lagunas':'hidrologia/estaciones',signal);
 if(!Array.isArray(result.data)||result.data.some(point=>!Number.isFinite(point.lat)||!Number.isFinite(point.lon)||typeof point.name!=='string'))throw new Error('No pudimos verificar las ubicaciones del inventario.');
 return result;
}
export async function getPanorama(eventId:string,signal:AbortSignal){
 const result=await get<PanoramaData>(`riesgo/panorama?evento_id=${encodeURIComponent(eventId)}`,signal);
 const data=result.data;
 const countValid=(value:unknown)=>value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=0);
 if(!data||data.event?.id!==eventId||!Number.isFinite(data.radiusKm)||data.radiusKm<0||!data.counts||!countValid(data.counts.lakes)||!countValid(data.counts.stations)||!(data.index===null||(Number.isFinite(data.index)&&data.index>=0&&data.index<=100))||!Array.isArray(data.factors)||!Array.isArray(data.sources)||!Array.isArray(data.warnings))throw new Error('No pudimos verificar el contexto de este reporte. Intenta consultar de nuevo.');
 if(data.population&&(!Number.isFinite(data.population.inhabitants)||data.population.inhabitants<0))throw new Error('El dato de población recibido no se pudo verificar.');
 return result;
}
export async function getServices(signal:AbortSignal){
 const result=await get<ServiceDefinition[]>('catalogo/servicios',signal);
 if(!Array.isArray(result.data)||result.data.some(service=>typeof service.id!=='string'||typeof service.name!=='string'||typeof service.route!=='string'||!service.availability||!['not-queried','ok','degraded','unavailable','not-integrated'].includes(service.availability.status)))throw new Error('No pudimos verificar el catálogo de servicios.');
 return result;
}
export function getContract(kind:'soap'|'wfs',signal:AbortSignal){return get<unknown>(`catalogo/contrato-${kind}`,signal);}
export const openApiUrl=`${apiBase}/api/v1/openapi.json`;
export async function searchLocalities(query:string,signal:AbortSignal){
 const result=await get<PublicLocality[]>(`localidades?q=${encodeURIComponent(query)}`,signal);
 if(!Array.isArray(result.data)||result.data.some(place=>!/^\d{6}$/.test(place.ubigeo)||typeof place.district!=='string'||!Number.isFinite(place.lat)||!Number.isFinite(place.lon)))throw new Error('La fuente no devolvió localidades verificables.');
 return result;
}
export async function getEvent(eventId:string,signal:AbortSignal){
 const result=await get<PublicEvent>(`sismos/${encodeURIComponent(eventId)}`,signal);const event=result.data;
 if(!event||event.id!==eventId||!Number.isFinite(event.lat)||!Number.isFinite(event.lon)||!Number.isFinite(event.magnitude)||!Number.isFinite(event.depth)||!Number.isFinite(Date.parse(event.date)))throw new Error('El reporte compartido no devolvió datos verificables.');
 return result;
}
