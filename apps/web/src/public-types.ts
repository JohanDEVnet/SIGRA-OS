export interface PublicEvent {id:string;date:string;lat:number;lon:number;magnitude:number;depth:number;reference:string;region:string|null;reportUrl:string|null}
export interface SourceMeta {source:string;sourceUrl:string;obtainedAt:string;status:'ok'|'degraded';fromCache:boolean;warnings:string[];dateOfData?:string|null;dateRange?:{from:string;to:string};inventoryYear?:number|string;inventoryDate?:string;hasMore?:boolean;kind?:'inventory';observationDate?:string|null;total?:number;totalInventory?:number;datasetDistrictCount?:number;cacheLayer?:'memory'|'supabase';durationMs?:number;scope?:'administrative_districts';limit?:number;center?:Coordinates;radiusKm?:number}
export interface Envelope<T> {data:T;meta:SourceMeta}
export interface Coordinates {lat:number;lon:number}
export interface CurrentWeather {temperature:number;precipitation:number;wind:number;time:string;lat:number;lon:number}
export interface PublicPopulation {ubigeo:string;district:string;province:string;region:string;population:number;fecha_corte:string;measure:'identified_dni';resourceUrl:string}
export interface InventoryPoint {id:string;name:string;lat:number;lon:number;region?:string|null;province?:string|null;district?:string|null;altitude?:number|null;riskLevel?:string|null;areaKm2?:number|null;mountainRange?:string|null}
export interface PublicLocality {ubigeo:string;district:string;province:string|null;region:string|null;lat:number;lon:number}
export interface PanoramaDistrict {ubigeo:string;district:string;province:string|null;region:string|null;lat?:number;lon?:number;method:'contains'|'nearest';distanceKm?:number;sourceUrl:string;obtainedAt:string}
export interface PanoramaPopulation {ubigeo:string;district:string;province:string|null;region:string|null;inhabitants:number;referenceDate:string;sourceUrl?:string;measure?:string}
export interface PanoramaFactor {id:string;name:string;source:string;score:number|null;weight:number;contribution:number|null;available:boolean}
export interface PanoramaSource {id:string;status:'ok'|'degraded'|'unavailable';obtainedAt:string|null;dateOfData?:string|null;sourceUrl:string;warnings:string[];durationMs?:number}
export interface PanoramaData {event:PublicEvent;district:PanoramaDistrict|null;population:PanoramaPopulation|null;radiusKm:number;counts:{lakes:number|null;stations:number|null};index:number|null;level:'Bajo'|'Moderado'|'Alto'|'Muy alto'|'Sin cálculo';partial:boolean;factors:PanoramaFactor[];sources:PanoramaSource[];warnings:string[];trace?:{id:string;totalMs:number;steps:{source:string;status:string;durationMs:number}[]}}
export interface ServiceAvailability {status:'not-queried'|'ok'|'degraded'|'unavailable'|'not-integrated';lastChecked:string|null;lastSuccess:string|null;detail:string}
export interface ServiceDefinition {availability:ServiceAvailability;id:string;name:string;provider:string;route:string;protocol:string;ttl:string;kind?:string;integration?:string}
