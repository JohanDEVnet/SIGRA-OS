import {useEffect,useRef,useState} from 'react';
import {Icon} from './icons';
import {getPanorama} from './public-api';
import type {Envelope,PanoramaData,PublicEvent} from './public-types';

const number=new Intl.NumberFormat('es-PE',{maximumFractionDigits:1});
const date=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Fecha no disponible';
const safeLink=(value:string)=>/^https?:\/\//i.test(value)?value:undefined;
const statusLabel={ok:'Disponible',degraded:'Última consulta guardada',unavailable:'No disponible'};

export default function PanoramaCard({event,onResponse,refreshToken=0}:{event:PublicEvent;refreshToken?:number;onResponse?:(response:Envelope<PanoramaData>|null)=>void}){
 const [response,setResponse]=useState<Envelope<PanoramaData>|null>(null);
 const processedRefresh=useRef(refreshToken);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  processedRefresh.current=refreshToken;setLoading(true);setError('');
  getPanorama(event.id,AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]))
   .then(result=>{if(active){setResponse(result);onResponse?.(result);}})
   .catch(problem=>{if(active)setError(problem instanceof Error&&problem.name==='TimeoutError'?'Las fuentes están tardando en responder. Intenta consultar de nuevo.':problem instanceof Error?problem.message:'El contexto no está disponible en este momento.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;controller.abort();};
 },[event.id,revision,onResponse]);
 useEffect(()=>{if(!loading&&processedRefresh.current!==refreshToken){processedRefresh.current=refreshToken;setRevision(value=>value+1);}},[refreshToken,loading]);
 const data=response?.data.event.id===event.id?response.data:null;
 const warnings=[...new Set([...(data?.warnings||[]),...(response?.meta.warnings||[])])];
 const missing=data?.factors.filter(factor=>!factor.available)||[];
 return <section className="panorama-section" aria-labelledby="panorama-title" aria-busy={loading}>
  <div className="panorama-heading"><div><span className="section-eyebrow">MÁS ALLÁ DEL EPICENTRO</span><h2 className="section-title" id="panorama-title">El entorno del sismo.</h2><p className="section-description">Distrito de referencia y ubicaciones cercanas.</p></div><div className="panorama-heading-actions"><span className="panorama-event">Reporte {event.id}</span><button className="refresh-button" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Actualizar contexto <Icon name="refresh" size={15}/></button></div></div>
  {loading&&!data&&<div className="panorama-loading" role="status"><span className="spinner"/><div><strong>Consultando el contexto de este lugar…</strong><p>Reunimos cinco fuentes. La consulta puede tardar unos segundos.</p></div></div>}
  {!loading&&error&&<div className="public-alert" role="alert"><Icon name="book"/><div><strong>No pudimos consultar el contexto.</strong><p>{error} Los datos del sismo siguen disponibles en el mapa.</p></div><button className="refresh-button" onClick={()=>setRevision(value=>value+1)}>Reintentar <Icon name="refresh" size={15}/></button></div>}
  {data&&<><div className="panorama-layout"><div className="panorama-territory"><div className="panorama-district"><Icon name="map" size={22}/><div><span className="panorama-label">Distrito de referencia</span><h3>{data.district?.district||'Distrito no identificado'}</h3><p>{data.district?[data.district.province,data.district.region,`Ubigeo ${data.district.ubigeo}`].filter(Boolean).join(' · '):'La fuente geográfica no permitió identificar un distrito para este epicentro.'}</p></div></div>
    {data.district?.method==='nearest'&&<p className="district-association">Distrito más cercano{typeof data.district.distanceKm==='number'?` (${number.format(data.district.distanceKm)} km hasta su límite)`:''}. El epicentro está fuera del distrito.</p>}
    <dl className="panorama-facts"><div><dt><Icon name="people" size={17}/>{data.population?.measure==='identified_dni'?'Población identificada con DNI':'Población distrital'}</dt><dd>{data.population?number.format(data.population.inhabitants):'No disponible'}{data.population&&<span>{data.population.measure==='identified_dni'?'Personas registradas':'Personas'} · referencia {data.population.referenceDate}</span>}</dd></div><div><dt><Icon name="map" size={17}/>Radio de consulta</dt><dd>{number.format(data.radiusKm)}<small> km</small><span>Distancia alrededor del epicentro</span></dd></div><div><dt><Icon name="mountain" size={17}/>Lagunas en el radio</dt><dd>{data.counts.lakes===null?'No disponible':number.format(data.counts.lakes)}<span>Ubicaciones de inventario INAIGEM</span></dd></div><div><dt><Icon name="water" size={17}/>Estaciones en el radio</dt><dd>{data.counts.stations===null?'No disponible':number.format(data.counts.stations)}<span>Ubicaciones de inventario SENAMHI</span></dd></div></dl>
    <p className="panorama-note">El recuento indica proximidad geográfica. No representa el estado actual de una laguna, un nivel de río ni población afectada.</p>
   </div><div className="panorama-index"><div className="panorama-index-top"><span className="panorama-label">Índice orientativo académico</span><span className={`panorama-status ${data.index===null?'unavailable':error||data.partial?'partial':'available'}`}>{data.index===null?'Sin cálculo':error?'Consulta anterior':data.partial?'Resultado parcial':'Fuentes completas'}</span></div><div className="panorama-index-value"><strong>{data.index===null?'—':number.format(data.index)}</strong>{data.index!==null&&<span>/ 100</span>}<span className="panorama-level">{data.level}</span></div><p className="panorama-index-description">{data.index===null?missing.length>=2?'Faltan al menos dos factores. No se publica un índice con esta información.':missing.some(factor=>factor.id==='F1')?'La información sísmica es indispensable para calcular el índice.':'La información disponible no permite calcular el índice.':data.partial?missing.length>0?'Un factor no está disponible. Su peso se redistribuye entre los factores presentes.':'Una o más fuentes utilizan información guardada; revisa sus fechas antes de interpretar el resultado.':'Cinco factores del territorio, con las ponderaciones del proyecto universitario.'}</p>
    <details className="panorama-factors"><summary>Ver los factores y sus pesos <Icon name="layers" size={15}/></summary><div>{data.factors.map(factor=><div className="panorama-factor" key={factor.id}><div><strong>{factor.name}</strong><span>{factor.source}</span></div><span>{factor.available&&factor.score!==null?`${number.format(factor.score)} / 100`:'No disponible'}<small>Peso {number.format(factor.weight*100)} %</small></span></div>)}</div></details><p className="panorama-note">Propuesta académica. Este índice no predice daños ni constituye una alerta oficial.</p>
   </div></div>

   <details className="panorama-provenance"><summary><span><Icon name="book" size={16}/>Fuentes y fechas de esta consulta</span><span>{date(response?.meta.obtainedAt||null)} · Perú</span></summary>   {warnings.length>0&&<details className="panorama-warnings"><summary><Icon name="book" size={18}/>Para interpretar esta consulta <span>{warnings.length} notas de las fuentes</span></summary><ul>{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></details>}<div className="panorama-source-list">{data.sources.map(source=><div className="panorama-source" key={source.id}><div><strong>{source.id}</strong><span className={`panorama-status ${source.status==='ok'?'available':source.status==='degraded'?'partial':'unavailable'}`}>{statusLabel[source.status]}</span></div><p>{source.obtainedAt?`Consultado ${date(source.obtainedAt)} · Perú`:'La fuente no devolvió datos verificables.'}</p>{safeLink(source.sourceUrl)&&<a href={safeLink(source.sourceUrl)} target="_blank" rel="noreferrer">Abrir fuente <Icon name="external" size={13}/></a>}{source.dateOfData&&<p>Fecha del dato: {source.dateOfData.length===10?source.dateOfData:date(source.dateOfData)}</p>}{source.warnings.map(warning=><p className="panorama-source-warning" key={warning}>{warning}</p>)}</div>)}</div></details>
  </>}
 </section>;
}
