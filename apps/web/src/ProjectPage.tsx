import {BrandMark,Icon} from './icons';
import ServiceConnections from './ServiceConnections';
import TerritoryFigure from './TerritoryFigure';

export default function ProjectPage(){return <div className="public-site project-page">
 <header className="public-header"><a className="public-brand" href="#inicio" aria-label="SIGRA, inicio"><span className="brand-symbol"><BrandMark/></span><span className="brand-wordmark">SIGRA<small>TERRITORIO CONECTADO</small></span></a><a className="quiet-link" href="#explorar">Volver al mapa <Icon name="arrow" size={17}/></a></header>
 <main className="container"><div className="project-intro"><span className="section-eyebrow">EL PROYECTO UNIVERSITARIO</span><h1>Una mirada conectada al territorio.</h1><p>SIGRA reúne información pública del Perú para consultar sismos y conocer su entorno. Proyecto del Grupo 3 de Arquitectura Orientada a Servicios.</p><p>React presenta los datos; la API NestJS consulta las fuentes y calcula los cinco factores del proyecto. Los nueve contratos se implementan en una API modular. El índice académico conserva la procedencia y las fechas de cada consulta.</p></div><ServiceConnections/><TerritoryFigure/><div className="project-return"><a className="public-button ghost" href="#explorar">Explorar los reportes <Icon name="arrow" size={18}/></a></div></main>
 <footer className="public-footer"><div className="container"><div className="footer-bottom"><span>SIGRA · Grupo 3 · 2026</span><a href="#inicio">Ir a la página pública</a></div></div></footer>
 </div>;}
