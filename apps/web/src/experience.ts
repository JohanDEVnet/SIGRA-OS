export interface ZoneFocus {lat:number;lon:number;label:string;kind:'district'|'device';ubigeo?:string}
export interface Preferences {days:number;magnitude:string;search:string;zone:ZoneFocus|null;radius:number}
export const defaultPreferences:Preferences={days:7,magnitude:'0',search:'',zone:null,radius:100};
export const preferenceKey='sigra:preferences:v1';
export function parsePreferences(raw:string|null):Preferences {
 try {
  const value=JSON.parse(raw||'null');if(!value||typeof value!=='object')return {...defaultPreferences};
  const candidate=value.zone;
  const zone:ZoneFocus|null=candidate?.kind==='district'&&/^\d{6}$/.test(candidate.ubigeo)&&typeof candidate.label==='string'&&candidate.label.length<=180&&Number.isFinite(candidate.lat)&&candidate.lat>=-20&&candidate.lat<=2&&Number.isFinite(candidate.lon)&&candidate.lon>=-83&&candidate.lon<=-67?{kind:'district',ubigeo:candidate.ubigeo,label:candidate.label,lat:candidate.lat,lon:candidate.lon}:null;
  return {days:[7,30,90].includes(value.days)?value.days:7,magnitude:['0','4','5','6'].includes(value.magnitude)?value.magnitude:'0',search:typeof value.search==='string'?value.search.slice(0,100):'',zone,radius:[100,300,500].includes(value.radius)?value.radius:100};
 }catch{return {...defaultPreferences};}
}
export function readPreferences():Preferences {try{return parsePreferences(localStorage.getItem(preferenceKey));}catch{return {...defaultPreferences};}}
export function savePreferences(preferences:Preferences):void {try{localStorage.setItem(preferenceKey,JSON.stringify({...preferences,zone:preferences.zone?.kind==='district'?preferences.zone:null}));}catch{/* Browsing remains available when storage is blocked. */}}
export function distanceKm(a:{lat:number;lon:number},b:{lat:number;lon:number}):number {
 const toRadians=Math.PI/180;const dLat=(b.lat-a.lat)*toRadians;const dLon=(b.lon-a.lon)*toRadians;
 const value=Math.sin(dLat/2)**2+Math.cos(a.lat*toRadians)*Math.cos(b.lat*toRadians)*Math.sin(dLon/2)**2;
 return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,value))));
}
export function sharedReport(url:string):string|null {try{const value=new URL(url).searchParams.get('evento');return value&&/^\d{4}-\d{4,8}$/.test(value)?value:null;}catch{return null;}}
export function reportUrl(url:string,eventId:string):string {const target=new URL(url);target.search='';target.searchParams.set('evento',eventId);target.searchParams.set('periodo','90');target.hash='explorar';return target.href;}
