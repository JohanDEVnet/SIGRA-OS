import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import { Icon } from './icons';

const Terrain=lazy(()=>import('@lucasmarkes/hairline/react').then(module=>({default:module.Terrain})));

export default function TerritoryFigure(){
 const section=useRef<HTMLElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'400px'});
  if(section.current)observer.observe(section.current);
  return()=>observer.disconnect();
 },[]);
 const placeholder=<div className="hairline-placeholder" aria-hidden="true"><Icon name="mountain" size={100}/></div>;
 return <section ref={section} className="territory-story" aria-labelledby="territory-story-title">
  <div className="territory-story-copy"><span className="section-eyebrow">UNA MIRADA CONECTADA</span><h2 id="territory-story-title">El territorio se entiende<br/><em>con más de una perspectiva.</em></h2><p>Un sismo es el punto de partida. Las lagunas, las estaciones, la población y el tiempo ayudan a conocer el lugar que lo rodea.</p><a className="quiet-link" href="#explorar">Encuentra un lugar en el mapa <Icon name="arrow" size={18}/></a><div className="territory-story-key"><span><Icon name="quake" size={17}/>Sismos</span><span><Icon name="mountain" size={17}/>Lagunas</span><span><Icon name="water" size={17}/>Estaciones</span><span><Icon name="people" size={17}/>Población</span><span><Icon name="weather" size={17}/>Tiempo</span></div></div>
  <figure className="territory-figure"><div className="territory-figure-heading"><span>RELIEVE · PERSPECTIVA</span><span className="territory-figure-hint">Explora con el cursor</span></div>{visible?<Suspense fallback={placeholder}><Terrain className="hairline-terrain" intensity={0.38} theme="light" label="Ilustración conceptual interactiva de un relieve; no representa datos geográficos"/></Suspense>:placeholder}<figcaption><span>Una forma de acercarnos al territorio.</span><small>Figura conceptual · Hairline</small></figcaption></figure>
 </section>;
}
