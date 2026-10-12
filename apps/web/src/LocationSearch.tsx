import {useEffect,useId,useRef,useState} from 'react';
import {Icon} from './icons';
import {searchLocalities} from './public-api';
import type {PublicLocality} from './public-types';
import type {ZoneFocus} from './experience';

export default function LocationSearch({onChoose,allowNearby=true}:{onChoose:(zone:ZoneFocus)=>void;allowNearby?:boolean}){
 const [query,setQuery]=useState('');const [results,setResults]=useState<PublicLocality[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);const [locating,setLocating]=useState(false);
 const [hasMore,setHasMore]=useState(false);
 const id=useId();const root=useRef<HTMLDivElement>(null);const input=useRef<HTMLInputElement>(null);const request=useRef(0);
 useEffect(()=>{
  const controller=new AbortController();const text=query.trim();setResults([]);setError('');setActive(-1);
  if(text.length<2){setLoading(false);return;}
  setLoading(true);let alive=true;
  const timer=window.setTimeout(()=>{searchLocalities(text,AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]))
   .then(response=>{if(alive){setResults(response.data);setHasMore(Boolean(response.meta.hasMore));}}).catch(problem=>{if(alive)setError(problem instanceof Error?problem.message:'No pudimos consultar las localidades.');}).finally(()=>{if(alive)setLoading(false);});},450);
  return()=>{alive=false;window.clearTimeout(timer);controller.abort();};
 },[query]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>{document.removeEventListener('pointerdown',outside);request.current++;};},[]);
 const choose=(place:PublicLocality)=>{onChoose({kind:'district',ubigeo:place.ubigeo,lat:place.lat,lon:place.lon,label:[place.district,place.province,place.region].filter(Boolean).join(' · ')});setOpen(false);setQuery('');input.current?.focus();};
 const locate=()=>{
  setError('');setOpen(false);if(!navigator.geolocation){setError('Este navegador no permite obtener tu ubicación. Busca tu distrito.');return;}
  setLocating(true);const token=++request.current;
  navigator.geolocation.getCurrentPosition(position=>{if(token!==request.current)return;setLocating(false);onChoose({kind:'device',lat:position.coords.latitude,lon:position.coords.longitude,label:'Tu ubicación aproximada'});},problem=>{if(token!==request.current)return;setLocating(false);setError(problem.code===1?'No se autorizó la ubicación. Puedes buscar tu distrito.':problem.code===3?'La ubicación está tardando. Busca tu distrito o vuelve a intentar.':'No pudimos obtener tu ubicación. Puedes buscar tu distrito.');},{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
 };
 return <div className="location-tools">
  <div className="locality-search" ref={root} onBlur={event=>{if(event.relatedTarget instanceof Node&&!root.current?.contains(event.relatedTarget))setOpen(false);}}>
   <label className="locality-input"><Icon name="search" size={20}/><input ref={input} role="combobox" aria-label="Buscar distrito o ciudad" aria-expanded={open&&query.trim().length>=2} aria-autocomplete="list" aria-controls={`${id}-results`} aria-activedescendant={open&&active>=0?`${id}-${active}`:undefined} placeholder="Busca tu distrito o ciudad" value={query} maxLength={80} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setOpen(true);}} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);return;}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);if(results.length)setActive(previous=>previous<0?(event.key==='ArrowDown'?0:results.length-1):(previous+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}if(event.key==='Enter'&&open&&results.length){event.preventDefault();choose(results[Math.max(0,active)]);}}}/>{loading&&<span className="spinner"/>}</label>
   {open&&query.trim().length>=2&&<div className="locality-results"><ul id={`${id}-results`} role="listbox" aria-label="Localidades oficiales INEI">{results.map((place,index)=><li key={place.ubigeo} id={`${id}-${index}`} role="option" aria-selected={index===active} className={index===active?'active':''} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(place)}><strong>{place.district}</strong><span>{[place.province,place.region].filter(Boolean).join(' · ')} · {place.ubigeo}</span></li>)}</ul>{loading?<p role="status">Buscando en la cartografía INEI…</p>:error?<p role="alert">{error}</p>:results.length===0?<p>No encontramos ese distrito. Prueba otro nombre.</p>:<small>{hasMore?'Hay más coincidencias. Escribe el nombre completo o el ubigeo para precisar.':'Ubicaciones de referencia de la cartografía INEI.'}</small>}</div>}
  </div>
  {allowNearby&&<button className="nearby-button" disabled={locating} onClick={locate}><Icon name="locate" size={19}/>{locating?'Buscando ubicación…':'Cerca de mí'}</button>}
  {error&&!open&&<p className="location-error" role="status">{error}</p>}
 </div>;
}
