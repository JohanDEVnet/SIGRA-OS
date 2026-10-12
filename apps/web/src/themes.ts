import {distanceKm,type ZoneFocus} from './experience';
import type {InventoryPoint} from './public-types';
export type Theme='sismos'|'tiempo'|'lagunas'|'agua'|'poblacion';
export function themeFromHash(hash:string):Theme {return hash==='#tiempo'?'tiempo':hash==='#lagunas'?'lagunas':hash==='#agua'?'agua':hash==='#poblacion'?'poblacion':'sismos';}
export function inventoryResults(points:InventoryPoint[],query:string,zone:ZoneFocus|null,radius:number):InventoryPoint[]{
 const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const text=fold(query.trim());
 return points.filter(point=>fold(`${point.name} ${point.id} ${point.region||''}`).includes(text)&&(!zone||distanceKm(zone,point)<=radius)).sort((a,b)=>zone?distanceKm(zone,a)-distanceKm(zone,b):a.name.localeCompare(b.name,'es'));
}
