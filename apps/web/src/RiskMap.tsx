import {useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import type {PublicEvent,InventoryPoint} from './public-types';
import {Icon} from './icons';
import './RiskMap.css';

const peruBounds:L.LatLngBoundsExpression=[[-18.5,-81.8],[-.1,-68.5]];
const clusterCellSize=62;
const maxZoom=18;
type PointKind='quakes'|'lakes'|'stations';
type MapPoint={id:string;lat:number;lon:number;kind:PointKind;event?:PublicEvent;inventory?:InventoryPoint};
export interface LocalityCenter {lat:number;lon:number;label?:string;zoom?:number}
export type InventoryKind='lakes'|'stations';
export interface InventorySelection {kind:InventoryKind;id:string}
export interface RiskMapProps {
 events:PublicEvent[];
 lakes:InventoryPoint[];
 stations:InventoryPoint[];
 selectedId:string|null;
 focusId:string|null;
 onSelect:(id:string)=>void;
 radiusKm?:number;
 /** A real locality returned by a location source; clear it to focus an event. */
 center?:LocalityCenter|null;
 /** Increment when the user explicitly requests the same locality again. */
 centerRequestKey?:string|number;
 onSelectInventory?:(kind:InventoryKind,point:InventoryPoint)=>void;
 selectedInventory?:InventorySelection|null;
 mapLabel?:string;
 sourceLabel?:string;
}
const motionAllowed=()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const validPoint=(point:{lat:number;lon:number})=>Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;
const kindLabel:Record<PointKind,string>={quakes:'sismos',lakes:'lagunas',stations:'estaciones'};

/** The same geographic cell always groups the same points at the same zoom.
 * Markers retain their source coordinates; a group's symbol uses a real member.
 */
function groupPoints(instance:L.Map,points:MapPoint[]){
 const groups=new Map<string,MapPoint[]>();const zoom=instance.getZoom();
 for(const point of points){
  if(!validPoint(point))continue;
  const projected=instance.project([point.lat,point.lon],zoom);
  const key=`${point.kind}:${Math.floor(projected.x/clusterCellSize)}:${Math.floor(projected.y/clusterCellSize)}`;
  const group=groups.get(key);if(group)group.push(point);else groups.set(key,[point]);
 }
 return [...groups.values()];
}
function inventoryContent(point:MapPoint){
 const content=document.createElement('div');const title=document.createElement('strong');const note=document.createElement('p');
 title.textContent=point.inventory?.name||point.id;
 note.textContent=point.kind==='lakes'?'Ubicación del inventario de lagunas glaciares 2024. No indica el estado actual de la laguna.':'Estación del inventario hidrológico SENAMHI. Esta capa no contiene observaciones actuales de nivel o caudal.';
 content.append(title,note);return content;
}
function overlapContent(instance:L.Map,points:MapPoint[],onSelect:(id:string)=>void,onSelectInventory?:RiskMapProps['onSelectInventory']){
 const content=document.createElement('div');content.className='risk-overlap';
 const title=document.createElement('strong');title.textContent=`${points.length} ${kindLabel[points[0].kind]} en esta zona`;
 const note=document.createElement('p');note.textContent='Estos puntos están muy próximos. Sus coordenadas originales se mantienen.';
 const list=document.createElement('div');list.className='risk-overlap-list';
 for(const point of points){
  const button=document.createElement('button');button.type='button';
  button.textContent=point.event?`M ${point.event.magnitude.toFixed(1)} · ${point.event.reference}`:point.inventory?.name||point.id;
  button.addEventListener('click',()=>{
   if(point.event){instance.closePopup();onSelect(point.event.id);}
   else if(onSelectInventory&&point.inventory&&point.kind!=='quakes'){instance.closePopup();onSelectInventory(point.kind,point.inventory);}
   else L.popup().setLatLng([point.lat,point.lon]).setContent(inventoryContent(point)).openOn(instance);
  });
  list.append(button);
 }
 content.append(title,note,list);return content;
}
function drawPoints(instance:L.Map,layer:L.LayerGroup,props:RiskMapProps){
 instance.closePopup();
 layer.clearLayers();
 const points:MapPoint[]=[...props.events.map(event=>({id:event.id,lat:event.lat,lon:event.lon,kind:'quakes' as const,event})),...props.lakes.map(inventory=>({id:inventory.id,lat:inventory.lat,lon:inventory.lon,kind:'lakes' as const,inventory})),...props.stations.map(inventory=>({id:inventory.id,lat:inventory.lat,lon:inventory.lon,kind:'stations' as const,inventory}))];
 const selected=props.events.find(event=>event.id===props.selectedId);
 if(selected&&validPoint(selected)&&props.radiusKm&&Number.isFinite(props.radiusKm)&&props.radiusKm>0){
  const ring=L.circle([selected.lat,selected.lon],{radius:props.radiusKm*1000,color:'#6d855d',weight:1,dashArray:'4 5',fillColor:'#6d855d',fillOpacity:.07,interactive:false}).addTo(layer);
  ring.bringToBack();
 }
 for(const members of groupPoints(instance,points)){
  if(members.length>1){
   // Anchor the aggregate at an actual record, never at an invented coordinate.
   const isSelected=(point:MapPoint)=>point.kind==='quakes'?point.event?.id===props.selectedId:point.kind===props.selectedInventory?.kind&&point.id===props.selectedInventory.id;
   const anchor=members.find(isSelected)||members[0];
   const selectedGroup=members.some(isSelected);
   const strongGroup=members.some(point=>(point.event?.magnitude??0)>=5);
   const size=members.length>=100?48:members.length>=10?44:40;
   const icon=L.divIcon({className:'risk-cluster-wrap',html:`<div class="risk-cluster risk-cluster-${anchor.kind} ${strongGroup?'has-strong':''} ${selectedGroup?'is-selected':''}"><strong>${members.length}</strong></div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
   const marker=L.marker([anchor.lat,anchor.lon],{icon,title:`${members.length} ${kindLabel[anchor.kind]} agrupados. Acercar para explorar.`,keyboard:true,zIndexOffset:selectedGroup?700:180}).addTo(layer);
   const tooltip=document.createElement('span');tooltip.textContent=`${members.length} ${kindLabel[anchor.kind]} · acerca el mapa${selectedGroup?' · incluye el punto seleccionado':''}`;
   marker.bindTooltip(tooltip,{direction:'top',className:'public-map-tooltip'});
   marker.on('click',()=>{
    if(instance.getZoom()>=maxZoom){L.popup().setLatLng([anchor.lat,anchor.lon]).setContent(overlapContent(instance,members,props.onSelect,props.onSelectInventory)).openOn(instance);return;}
    const bounds=L.latLngBounds(members.map(point=>L.latLng(point.lat,point.lon)));
    instance.fitBounds(bounds,{padding:[48,48],maxZoom:Math.min(maxZoom,instance.getZoom()+2),animate:motionAllowed()});
   });
  }else{
   const point=members[0];
   if(point.event){
    const event=point.event;const chosen=event.id===props.selectedId;const tier=event.magnitude>=5?'strong':event.magnitude>=4?'medium':'light';
    const icon=L.divIcon({className:'quake-marker-wrap',html:`<div class="quake-marker marker-${tier} ${chosen?'selected':''}"><span>${event.magnitude.toFixed(1)}</span></div>`,iconSize:[38,38],iconAnchor:[19,19]});
    const marker=L.marker([point.lat,point.lon],{icon,title:`Sismo ${event.id}, magnitud ${event.magnitude.toFixed(1)}`,keyboard:true,zIndexOffset:chosen?750:250}).addTo(layer);
    const tooltip=document.createElement('span');tooltip.textContent=`M ${event.magnitude.toFixed(1)} · ${event.reference}`;
    marker.bindTooltip(tooltip,{direction:'top',className:'public-map-tooltip'}).on('click',()=>props.onSelect(event.id));
   }else{
    const title=document.createElement('span');title.textContent=`${point.inventory?.name||point.id} · ${point.kind==='lakes'?'Inventario INAIGEM 2024':'Inventario SENAMHI'}`;
    const chosen=point.kind===props.selectedInventory?.kind&&point.id===props.selectedInventory.id;
    const size=chosen?18:14;
    const icon=L.divIcon({className:`inventory-marker-wrap ${chosen?'inventory-selected-wrap':''}`,html:`<span class="inventory-marker ${point.kind} ${chosen?'selected':''}"></span>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
    const marker=L.marker([point.lat,point.lon],{icon,title:point.inventory?.name||point.id,keyboard:true,zIndexOffset:chosen?850:50}).addTo(layer).bindTooltip(title);
    if(props.onSelectInventory&&point.inventory&&point.kind!=='quakes')marker.on('click',()=>props.onSelectInventory?.(point.kind as InventoryKind,point.inventory!));
    else marker.bindPopup(inventoryContent(point));
   }
  }
 }
 if(props.center&&validPoint(props.center)){
  const locality=L.circleMarker([props.center.lat,props.center.lon],{radius:7,color:'#183e34',weight:2,fillColor:'#f7f7f0',fillOpacity:1,className:'risk-locality-marker is-selected',interactive:false}).addTo(layer);
  locality.bringToBack();
 }
}

export default function RiskMap(props:RiskMapProps){
 const current=useRef(props);current.current=props;
 // Parent polling can return identical records in new arrays, or new empty arrays.
 // Only rebuild when the rendered data changes, preserving open inventory popups.
 const dataKey=JSON.stringify([props.events.map(event=>[event.id,event.lat,event.lon,event.magnitude,event.reference]),props.lakes.map(point=>[point.id,point.lat,point.lon,point.name]),props.stations.map(point=>[point.id,point.lat,point.lon,point.name]),props.selectedId,props.selectedInventory?.kind,props.selectedInventory?.id,props.radiusKm,props.center?.lat,props.center?.lon,props.center?.label]);
 const element=useRef<HTMLDivElement>(null);const map=useRef<L.Map|null>(null);const markers=useRef<L.LayerGroup|null>(null);
 const redraw=useRef<(()=>void)|null>(null);const lastView=useRef<string|null>(null);const [tilesUnavailable,setTilesUnavailable]=useState(false);
 useEffect(()=>{
  if(!element.current)return;
  const instance=L.map(element.current,{zoomControl:false,scrollWheelZoom:false,maxZoom}).fitBounds(peruBounds,{padding:[12,12]});map.current=instance;
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom}).addTo(instance);
  tiles.on('tileerror',()=>setTilesUnavailable(true));tiles.on('tileload',()=>setTilesUnavailable(false));
  L.control.zoom({position:'bottomright'}).addTo(instance);L.control.scale({position:'bottomleft',imperial:false}).addTo(instance);
  const group=L.layerGroup().addTo(instance);markers.current=group;
  redraw.current=()=>drawPoints(instance,group,current.current);
  const update=()=>redraw.current?.();instance.on('zoomend',update);update();
  let frame:number|undefined;
  const observer=new ResizeObserver(()=>{if(frame!==undefined)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{instance.invalidateSize({pan:false});});});observer.observe(element.current);
  return()=>{if(frame!==undefined)cancelAnimationFrame(frame);observer.disconnect();instance.off('zoomend',update);tiles.off();redraw.current=null;instance.remove();map.current=null;markers.current=null;lastView.current=null;};
 },[]);
 useEffect(()=>{redraw.current?.();},[dataKey,props.onSelect,props.onSelectInventory]);
 useEffect(()=>{
  const instance=map.current;if(!instance)return;
  if(props.center&&validPoint(props.center)){
   const requestedZoom=typeof props.center.zoom==='number'&&Number.isFinite(props.center.zoom)?props.center.zoom:11;
   const zoom=Math.min(maxZoom,Math.max(3,requestedZoom));
   const key=`locality:${props.center.lat}:${props.center.lon}:${zoom}:${props.centerRequestKey??''}`;
   if(lastView.current===key)return;lastView.current=key;
   instance.flyTo([props.center.lat,props.center.lon],zoom,{duration:motionAllowed()?0.7:0});return;
  }
  if(props.focusId){
   const event=props.events.find(item=>item.id===props.focusId);if(!event||!validPoint(event))return;
   const key=`event:${event.id}`;if(lastView.current===key)return;lastView.current=key;
   instance.flyTo([event.lat,event.lon],7,{duration:motionAllowed()?0.7:0});return;
  }
  if(lastView.current==='national')return;lastView.current='national';instance.fitBounds(peruBounds,{padding:[12,12]});
 },[props.focusId,props.events,props.center?.lat,props.center?.lon,props.center?.zoom,props.centerRequestKey]);
 return <><div className="public-map" ref={element} aria-label={props.mapLabel||'Mapa de sismos y ubicaciones de inventarios oficiales en Perú'}/><div className="public-map-note"><Icon name="map" size={14}/>{tilesUnavailable?'El mapa base no está disponible. Los puntos conservan sus coordenadas.':`${props.sourceLabel||'IGP'} · OpenStreetMap${props.events.length+props.lakes.length+props.stations.length>0?' · acerca los grupos para ver sus puntos':''}`}</div></>;
}
