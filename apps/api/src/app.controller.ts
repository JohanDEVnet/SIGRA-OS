import { BadRequestException, Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { services } from '@sigra/domain';
import { IGP_BASE, PublicProviders, WEATHER_BASE } from './providers.js';
import { normalizeRegion, optionalNumber, optionalText, requiredCoordinate } from './query.js';
import { distanceKm, INAIGEM_URL, SENAMHI_URL } from './inventories.js';
import { ContractsService, SUNAT_WSDL_URL, SENAMHI_CAPABILITIES_URL } from './contracts.js';
import { PanoramaService } from './panorama.js';
import { buildOpenApiDocument } from './openapi.js';
import type { Envelope } from './providers.js';
import type { InventoryPoint } from './inventories.js';
@Controller()
export class AppController {
  private providers = new PublicProviders();
  private contracts = new ContractsService();
  private panoramaAvailability:{status:'not-queried'|'ok'|'degraded'|'unavailable';lastChecked:string|null;lastSuccess:string|null;detail:string}={status:'not-queried',lastChecked:null,lastSuccess:null,detail:'Todavía no se ha consultado un panorama en este servidor.'};
  @Get('health')
  health() { return { data: { status: 'ok', timestamp: new Date().toISOString(), service: 'SIGRA API', version: '0.3.0', persistence: this.providers.transport.persistenceStatus() }, meta: { source: 'SIGRA', scope: 'API process only', warnings: ['Este endpoint no verifica la disponibilidad de proveedores externos. La persistencia refleja la última operación real; configurada no significa conectada.'] } }; }
  @Get('sismos')
  async quakes(@Query() query: Record<string, unknown>) {
    const now = Date.now(); const currentYear = new Date(now).getUTCFullYear();
    const year = optionalNumber('anio', query.anio, { min: 2010, max: currentYear, integer: true }) ?? currentYear;
    const magnitude = optionalNumber('mag_min', query.mag_min, { min: 0, max: 10 }) ?? 4;
    const days = optionalNumber('dias', query.dias, { min: 1, max: 3650, integer: true }) ?? 7;
    const region = optionalText('region', query.region);
    const response = await this.providers.igp(year);
    const data = response.data.filter((event) => event.magnitude >= magnitude && Date.parse(event.date) >= now - days * 86_400_000 && (region === undefined || (event.region !== null && normalizeRegion(event.region) === normalizeRegion(region))));
    const dateRange = data.length ? { from: data[data.length - 1].date, to: data[0].date } : undefined;
    return { data, meta: { ...response.meta, ...(dateRange ? { dateRange } : {}), total: data.length, year } };
  }
  @Get('meteorologia/actual')
  weather(@Query() query: Record<string, unknown>) { return this.providers.weather(requiredCoordinate('lat', query.lat), requiredCoordinate('lon', query.lon)); }
  @Get('sismos/:eventoId')
  async quake(@Param('eventoId') eventoId: string) {
    if (!/^\d{4}-\d{4,}$/.test(eventoId) || eventoId.length > 40) throw new BadRequestException('eventoId debe tener el identificador publicado por IGP.');
    const year = optionalNumber('año de eventoId', eventoId.slice(0, 4), { min: 2010, max: new Date().getUTCFullYear(), integer: true })!;
    const response = await this.providers.igp(year);
    const data = response.data.find(event => event.id === eventoId);
    if (!data) throw new NotFoundException('El evento solicitado no existe en los reportes publicados por IGP.');
    return { data, meta: response.meta };
  }
  @Get('fuentes')
  sources() { return { data: [...this.providers.sourceStates(),...this.contracts.sourceStates()], meta: { source: 'SIGRA', sourceUrl:'/api/v1/fuentes', obtainedAt: new Date().toISOString(), status:'ok', fromCache:false, warnings: ['Los estados describen la última consulta de este servidor; no son una garantía de disponibilidad continua.'] } }; }
  @Get('catalogo/servicios')
  catalog() {
    const urls:Record<string,string>={'SIG-01':IGP_BASE,'SIG-02':SENAMHI_URL,'SIG-03':INAIGEM_URL,'SIG-04':'https://www.datosabiertos.gob.pe/','SIG-05':WEATHER_BASE,'SIG-06':'/api/v1/riesgo/panorama','SIG-07':'/api/v1/catalogo/servicios','SIG-08':SUNAT_WSDL_URL,'SIG-09':SENAMHI_CAPABILITIES_URL};
    const checkedAt=new Date().toISOString();
    const local={status:'ok',lastChecked:checkedAt,lastSuccess:checkedAt,detail:'Contrato local disponible en la API SIGRA.'};
    const states=[...this.providers.sourceStates(),...this.contracts.sourceStates()];
    const providerIds:Record<string,string>={'SIG-01':'IGP','SIG-02':'SENAMHI','SIG-03':'INAIGEM','SIG-04':'PCM / RENIEC','SIG-05':'Open-Meteo','SIG-08':'SUNAT','SIG-09':'SENAMHI-WFS'};
    const availability=(id:string)=>id==='SIG-06'?this.panoramaAvailability:id==='SIG-07'?local:((state)=>state?{status:state.status,lastChecked:state.lastChecked,lastSuccess:state.lastSuccess,detail:state.detail}:{status:'not-queried',lastChecked:null,lastSuccess:null,detail:'Fuente aún no consultada.'})(states.find(state=>state.id===providerIds[id]));
    return {data:services.map(service=>({...service,sourceUrl:urls[service.id],integration:'implemented',availability:availability(service.id)})),meta:{source:'SIGRA',sourceUrl:'/api/v1/catalogo/servicios',obtainedAt:new Date().toISOString(),status:'ok',fromCache:false,warnings:['Nueve contratos de servicios alojados en una API NestJS. La disponibilidad de cada proveedor depende de su última consulta.','Población RENIEC corresponde a personas identificadas con DNI; los inventarios no son observaciones en tiempo real.']}};
  }
  @Get('riesgo/panorama')
  async panorama(@Query() query:Record<string,unknown>) {
    const eventId=optionalText('evento_id',query.evento_id,40);
    if(eventId){if(!/^\d{4}-\d{4,}$/.test(eventId))throw new BadRequestException('evento_id debe tener el formato publicado por IGP, por ejemplo 2026-0731.');optionalNumber('año de evento_id',eventId.slice(0,4),{min:2010,max:new Date().getUTCFullYear(),integer:true});}
    const selection={eventId,days:optionalNumber('dias',query.dias,{min:1,max:3650,integer:true})??7,minMagnitude:optionalNumber('mag_min',query.mag_min,{min:0,max:10})??4,radiusKm:optionalNumber('radio_km',query.radio_km,{min:10,max:150})};
    try {
      const result=await new PanoramaService(this.providers).compose(selection);
      this.panoramaAvailability={status:result.meta.status,lastChecked:result.meta.obtainedAt,lastSuccess:result.meta.obtainedAt,detail:result.data.index===null?'Consulta completada sin datos suficientes para calcular el índice.':result.data.partial?'Consulta parcial; revisar fuentes y fechas.':'Consulta compuesta completada con los cinco factores.'};
      return result;
    } catch(error) {
      this.panoramaAvailability={status:'unavailable',lastChecked:new Date().toISOString(),lastSuccess:this.panoramaAvailability.lastSuccess,detail:'La última consulta compuesta no pudo completarse.'};
      throw error;
    }
  }
  @Get('hidrologia/estaciones')
  async stations(@Query() query: Record<string, unknown>) { const filter = this.inventoryFilter(query); const result = this.filterInventory(await this.providers.stations(), filter); return { ...result, meta: { ...result.meta, kind: 'inventory' } }; }
  @Get('glaciares/lagunas')
  async lakes(@Query() query: Record<string, unknown>) { const filter = this.inventoryFilter(query); const result = this.filterInventory(await this.providers.lakes(), filter); return { ...result, meta: { ...result.meta, kind: 'inventory', inventoryYear: '2024' } }; }
  @Get('poblacion/:ubigeo')
  population(@Param('ubigeo') ubigeo: string) { if (!/^\d{6}$/.test(ubigeo)) throw new BadRequestException('El ubigeo debe tener seis dígitos.'); return this.providers.realPopulation(ubigeo); }
  @Get('localidades')
  localities(@Query() query: Record<string, unknown>) {
    const q = optionalText('q', query.q, 80);
    if (!q) throw new BadRequestException('Se requiere q para buscar un distrito.');
    return this.providers.searchLocalities(q, optionalNumber('limite', query.limite, { min: 1, max: 12, integer: true }) ?? 10);
  }
  @Get('catalogo/contrato-soap')
  soapContract() { return this.contracts.soapDescriptor(); }
  @Get('catalogo/contrato-wfs')
  wfsContract() { return this.contracts.wfsCapabilities(); }
  @Get('openapi.json')
  openapi() { return buildOpenApiDocument(); }
  @Get('docs')
  @Header('Content-Type','text/html; charset=utf-8')
  docs() { return '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Contratos SIGRA</title><style>body{max-width:900px;margin:60px auto;padding:24px;font:16px/1.7 system-ui;color:#153b30;background:#f7f7ef}a{color:#315f45}li{margin:12px 0}code{font-size:14px}</style><h1>Contratos de SIGRA</h1><p>Los nueve servicios del Word se exponen mediante REST bajo /api/v1. Consulta sus parámetros, esquemas y errores en el documento OpenAPI 3.1.</p><p><a href="./openapi.json">Abrir OpenAPI 3.1</a></p><ul>'+services.map(s=>'<li><strong>'+s.id+' · '+s.name+'</strong><br><code>'+s.route+'</code> · '+s.protocol+'</li>').join('')+'</ul><p>SUNAT se utiliza únicamente para consultar el descriptor WSDL. Los datos del análisis conservan su origen y fecha.</p></html>'; }
  private inventoryFilter(query: Record<string, unknown>) {
    const region = optionalText('region', query.region);
    const radiusKm = optionalNumber('radio_km', query.radio_km, { min: 1, max: 1000 }) ?? 50;
    if (query.lat === undefined && query.lon === undefined) return { region, radiusKm };
    return { region, radiusKm, lat: requiredCoordinate('lat', query.lat), lon: requiredCoordinate('lon', query.lon) };
  }
  private filterInventory(response: Envelope<InventoryPoint[]>, filter: { region?: string; radiusKm: number; lat?: number; lon?: number }) {
    const data = response.data.filter((point) => (filter.region === undefined || (point.region !== null && normalizeRegion(point.region) === normalizeRegion(filter.region))) && (filter.lat === undefined || filter.lon === undefined || distanceKm(filter.lat, filter.lon, point) <= filter.radiusKm));
    return { data, meta: { ...response.meta, total: data.length, totalInventory: response.data.length, observationDate: null, ...(filter.lat !== undefined ? { center: { lat: filter.lat, lon: filter.lon }, radiusKm: filter.radiusKm } : {}) } };
  }
}
