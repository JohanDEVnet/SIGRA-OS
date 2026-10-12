import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Envelope } from './providers.js';

export const SUNAT_WSDL_URL = 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService?wsdl';
export const SENAMHI_CAPABILITIES_URL = 'https://idesep.senamhi.gob.pe/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities';
export const HYDROLOGICAL_LAYER = 'g_99_01:99_01_002_03_001_000_0000_00_00';
const WSDL_NS = 'http://schemas.xmlsoap.org/wsdl/';
const SOAP11_NS = 'http://schemas.xmlsoap.org/wsdl/soap/';
const SOAP12_NS = 'http://schemas.xmlsoap.org/wsdl/soap12/';
const WFS_NS = ['http://www.opengis.net/wfs/2.0', 'http://www.opengis.net/wfs'];
const OWS_NS = ['http://www.opengis.net/ows/1.1', 'http://www.opengis.net/ows'];
const MAX_XML_BYTES = 2 * 1024 * 1024;
type XmlNode = Record<string, unknown>;
type Namespaces = Record<string, string>;
interface Element { node: XmlNode; namespaces: Namespaces; value: unknown }

export interface SoapOperation { name: string; binding: string; soapAction: string | null; input: string | null; output: string | null; style: string | null }
export interface SoapBinding { name: string; type: string | null; protocol: 'SOAP 1.1' | 'SOAP 1.2' | 'unspecified'; transport: string | null; style: string | null; operations: string[] }
export interface SoapService { name: string; ports: { name: string; binding: string | null; address: string | null }[] }
export interface SoapDescriptor { version: '1.1'; targetNamespace: string; namespaces: Namespaces; imports: { namespace: string | null; location: string }[]; operations: SoapOperation[]; bindings: SoapBinding[]; services: SoapService[]; descriptorOnly: true }
export interface WfsOperation { name: string; getUrls: string[]; postUrls: string[]; parameters: Record<string, string[]> }
export interface WfsLayer { name: string; title: string; abstract: string | null; defaultCrs: string | null; otherCrs: string[]; formats: string[]; bounds?: { lower: [number, number]; upper: [number, number] } }
export interface WfsCapabilities { version: string; serviceTitle: string | null; namespaces: Namespaces; operations: WfsOperation[]; formats: string[]; layers: WfsLayer[]; hydrologicalLayer: string | null }

function object(value: unknown): XmlNode { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as XmlNode : {}; }
function list(value: unknown): unknown[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function string(value: unknown): string | null {
  const raw = typeof value === 'string' ? value : object(value)['#text'];
  if (typeof raw !== 'string') return null;
  // Decode only predefined XML escapes. No general entity expansion or external resolution.
  return raw.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[name]!).trim() || null;
}
function attribute(node: XmlNode, name: string): string | null { return string(node[`@_${name}`]); }
function namespaceScope(node: XmlNode, inherited: Namespaces = {}): Namespaces {
  const result: Namespaces = Object.assign(Object.create(null) as Namespaces, inherited);
  for (const [key, value] of Object.entries(node)) {
    if (key === '@_xmlns' && typeof value === 'string') result[''] = value;
    else if (key.startsWith('@_xmlns:') && typeof value === 'string') result[key.slice(8)] = value;
  }
  return result;
}
function elements(parent: XmlNode, localName: string, acceptedNamespaces: string[], inherited: Namespaces): Element[] {
  const found: Element[] = [];
  for (const [name, values] of Object.entries(parent)) {
    if (name.startsWith('@_') || name.startsWith('#') || name.startsWith('?')) continue;
    const separator = name.indexOf(':');
    const prefix = separator < 0 ? '' : name.slice(0, separator);
    const local = separator < 0 ? name : name.slice(separator + 1);
    if (local !== localName) continue;
    for (const value of list(values)) {
      const node = object(value); const namespaces = namespaceScope(node, inherited);
      if (acceptedNamespaces.includes(namespaces[prefix])) found.push({ node, namespaces, value });
    }
  }
  return found;
}
function childText(parent: Element, name: string, namespaces: string[]): string | null { return string(elements(parent.node, name, namespaces, parent.namespaces)[0]?.value); }
function requiredAttribute(node: XmlNode, name: string): string { const value = attribute(node, name); if (!value) throw new Error(`Atributo XML requerido ausente: ${name}.`); return value; }
function unique(values: (string | null)[]): string[] { return [...new Set(values.filter((value): value is string => value !== null))]; }

function safeRoot(xml: string, name: string, acceptedNamespaces: string[]): Element {
  if (!xml.trim() || Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES) throw new Error('Descriptor vacío o demasiado grande.');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Los descriptores con DTD o entidades declaradas no están permitidos.');
  if (XMLValidator.validate(xml, { allowBooleanAttributes: false }) !== true) throw new Error('XML del proveedor mal formado.');
  const parsed = object(new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: false, parseTagValue: false, trimValues: true, processEntities: false, ignoreDeclaration: true, ignorePiTags: true }).parse(xml));
  const roots = elements(parsed, name, acceptedNamespaces, {});
  if (roots.length !== 1) throw new Error('El documento no pertenece al contrato XML esperado.');
  return roots[0];
}

export function parseSoapDescriptor(xml: string): { data: SoapDescriptor; warnings: string[] } {
  const root = safeRoot(xml, 'definitions', [WSDL_NS]);
  const operations: SoapOperation[] = [];
  const bindings = elements(root.node, 'binding', [WSDL_NS], root.namespaces).map((binding): SoapBinding => {
    const name = requiredAttribute(binding.node, 'name');
    const soap11 = elements(binding.node, 'binding', [SOAP11_NS], binding.namespaces)[0];
    const soap12 = elements(binding.node, 'binding', [SOAP12_NS], binding.namespaces)[0];
    const soap = soap11 ?? soap12;
    const operationNodes = elements(binding.node, 'operation', [WSDL_NS], binding.namespaces);
    for (const operation of operationNodes) {
      const extension = elements(operation.node, 'operation', [SOAP11_NS, SOAP12_NS], operation.namespaces)[0];
      const input = elements(operation.node, 'input', [WSDL_NS], operation.namespaces)[0];
      const output = elements(operation.node, 'output', [WSDL_NS], operation.namespaces)[0];
      operations.push({ name: requiredAttribute(operation.node, 'name'), binding: name, soapAction: extension ? attribute(extension.node, 'soapAction') : null, input: input ? attribute(input.node, 'name') : null, output: output ? attribute(output.node, 'name') : null, style: extension ? attribute(extension.node, 'style') : null });
    }
    return { name, type: attribute(binding.node, 'type'), protocol: soap11 ? 'SOAP 1.1' : soap12 ? 'SOAP 1.2' : 'unspecified', transport: soap ? attribute(soap.node, 'transport') : null, style: soap ? attribute(soap.node, 'style') : null, operations: operationNodes.map((operation) => requiredAttribute(operation.node, 'name')) };
  });
  const services = elements(root.node, 'service', [WSDL_NS], root.namespaces).map((service): SoapService => ({ name: requiredAttribute(service.node, 'name'), ports: elements(service.node, 'port', [WSDL_NS], service.namespaces).map((port) => {
    const address = elements(port.node, 'address', [SOAP11_NS, SOAP12_NS], port.namespaces)[0];
    return { name: requiredAttribute(port.node, 'name'), binding: attribute(port.node, 'binding'), address: address ? attribute(address.node, 'location') : null };
  }) }));
  const imports = elements(root.node, 'import', [WSDL_NS], root.namespaces).map((item) => ({ namespace: attribute(item.node, 'namespace'), location: requiredAttribute(item.node, 'location') }));
  if (!bindings.length || !operations.length || !services.length) throw new Error('WSDL sin bindings, operaciones o servicios utilizables.');
  return { data: { version: '1.1', targetNamespace: requiredAttribute(root.node, 'targetNamespace'), namespaces: root.namespaces, imports, operations, bindings, services, descriptorOnly: true }, warnings: ['Solo se inspecciona el descriptor público. No se invocan operaciones SOAP ni se envían comprobantes.', ...(imports.length ? ['Los imports del WSDL se describen sin descargarlos; los mensajes y tipos importados no han sido inspeccionados.'] : [])] };
}

export function parseWfsCapabilities(xml: string): { data: WfsCapabilities; warnings: string[] } {
  const root = safeRoot(xml, 'WFS_Capabilities', WFS_NS);
  const version = requiredAttribute(root.node, 'version');
  if (!['1.0.0', '1.1.0', '2.0.0'].includes(version)) throw new Error('Versión WFS no compatible.');
  const metadata = elements(root.node, 'OperationsMetadata', OWS_NS, root.namespaces)[0];
  const featureTypeList = elements(root.node, 'FeatureTypeList', WFS_NS, root.namespaces)[0];
  if (!metadata || !featureTypeList) throw new Error('GetCapabilities sin operaciones o capas.');
  const operations = elements(metadata.node, 'Operation', OWS_NS, metadata.namespaces).map((operation): WfsOperation => {
    const getUrls: string[] = []; const postUrls: string[] = [];
    for (const dcp of elements(operation.node, 'DCP', OWS_NS, operation.namespaces)) {
      for (const http of elements(dcp.node, 'HTTP', OWS_NS, dcp.namespaces)) {
        for (const [method, output] of [['Get', getUrls], ['Post', postUrls]] as const) {
          for (const endpoint of elements(http.node, method, OWS_NS, http.namespaces)) {
            const url = Object.entries(endpoint.node).find(([key]) => key.startsWith('@_') && key.split(':').pop() === 'href')?.[1];
            const parsedUrl = string(url); if (parsedUrl) output.push(parsedUrl);
          }
        }
      }
    }
    const parameters: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
    for (const parameter of elements(operation.node, 'Parameter', OWS_NS, operation.namespaces)) {
      const allowed = elements(parameter.node, 'AllowedValues', OWS_NS, parameter.namespaces)[0];
      parameters[requiredAttribute(parameter.node, 'name')] = allowed ? unique(elements(allowed.node, 'Value', OWS_NS, allowed.namespaces).map((value) => string(value.value))) : [];
    }
    return { name: requiredAttribute(operation.node, 'name'), getUrls: unique(getUrls), postUrls: unique(postUrls), parameters };
  });
  const layers = elements(featureTypeList.node, 'FeatureType', WFS_NS, featureTypeList.namespaces).map((feature): WfsLayer => {
    const name = childText(feature, 'Name', WFS_NS); if (!name) throw new Error('Capa WFS sin nombre.');
    const boundsNode = elements(feature.node, 'WGS84BoundingBox', OWS_NS, feature.namespaces)[0];
    const layer: WfsLayer = { name, title: childText(feature, 'Title', WFS_NS) ?? name, abstract: childText(feature, 'Abstract', WFS_NS), defaultCrs: childText(feature, 'DefaultCRS', WFS_NS) ?? childText(feature, 'DefaultSRS', WFS_NS), otherCrs: unique([...elements(feature.node, 'OtherCRS', WFS_NS, feature.namespaces), ...elements(feature.node, 'OtherSRS', WFS_NS, feature.namespaces)].map((value) => string(value.value))), formats: [] };
    const formats = elements(feature.node, 'OutputFormats', WFS_NS, feature.namespaces)[0];
    if (formats) layer.formats = unique(elements(formats.node, 'Format', WFS_NS, formats.namespaces).map((value) => string(value.value)));
    if (boundsNode) {
      const lower = childText(boundsNode, 'LowerCorner', OWS_NS)?.split(/\s+/).map(Number); const upper = childText(boundsNode, 'UpperCorner', OWS_NS)?.split(/\s+/).map(Number);
      if (lower?.length === 2 && upper?.length === 2 && [...lower, ...upper].every(Number.isFinite)) layer.bounds = { lower: [lower[0], lower[1]], upper: [upper[0], upper[1]] };
    }
    return layer;
  });
  if (!operations.some((operation) => operation.name === 'GetFeature') || !layers.length) throw new Error('El servicio no anuncia GetFeature y capas disponibles.');
  const identification = elements(root.node, 'ServiceIdentification', OWS_NS, root.namespaces)[0];
  const formats = unique(operations.filter((operation) => operation.name === 'GetFeature').flatMap((operation) => operation.parameters.outputFormat ?? []));
  return { data: { version, serviceTitle: identification ? childText(identification, 'Title', OWS_NS) : null, namespaces: root.namespaces, operations, formats, layers, hydrologicalLayer: layers.some((layer) => layer.name === HYDROLOGICAL_LAYER) ? HYDROLOGICAL_LAYER : null }, warnings: ['Las operaciones y capas son declaraciones del proveedor; su presencia no prueba permisos de escritura ni disponibilidad permanente.', 'SIGRA consulta GetCapabilities mediante GET y no ejecuta transacciones WFS.'] };
}

class DescriptorFailure extends Error { constructor(public readonly code: 502 | 503 | 504, message: string) { super(message); } }
interface CacheEntry { envelope: Envelope<unknown>; storedAt: number }
interface ContractOptions { ttlMs?: number; staleMs?: number; timeoutMs?: number; sleep?: (delayMs: number) => Promise<void> }
export interface ContractState { id:string; name:string; sourceUrl:string; status:'not-queried'|'ok'|'degraded'|'unavailable'; lastChecked:string|null; lastSuccess:string|null; detail:string }

export class ContractsService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<Envelope<unknown>>>();
  private readonly states = new Map<string, ContractState>();
  private readonly ttlMs: number;
  private readonly staleMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  constructor(private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now, options: ContractOptions = {}) {
    this.ttlMs = options.ttlMs ?? 86_400_000;
    this.staleMs = options.staleMs ?? 7 * 86_400_000;
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }
  soapDescriptor(): Promise<Envelope<SoapDescriptor>> { return this.load('SUNAT', SUNAT_WSDL_URL, parseSoapDescriptor); }
  wfsCapabilities(): Promise<Envelope<WfsCapabilities>> { return this.load('SENAMHI', SENAMHI_CAPABILITIES_URL, parseWfsCapabilities); }
  sourceStates():ContractState[] {
    return [{id:'SUNAT',name:'SUNAT · descriptor SOAP',sourceUrl:SUNAT_WSDL_URL},{id:'SENAMHI-WFS',name:'SENAMHI · capacidades WFS',sourceUrl:SENAMHI_CAPABILITIES_URL}].map(source=>this.states.get(source.sourceUrl)??{...source,status:'not-queried',lastChecked:null,lastSuccess:null,detail:'El descriptor todavía no ha sido consultado por este servidor.'});
  }
  private async readDescriptor(sourceUrl: string): Promise<string> {
    try {
      const response = await this.fetcher(sourceUrl, { method: 'GET', headers: { Accept: 'application/xml,text/xml;q=0.9' }, signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) throw new DescriptorFailure(response.status >= 500 || response.status === 429 ? 503 : 502, `El proveedor devolvió HTTP ${response.status}.`);
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_XML_BYTES) { await response.body?.cancel(); throw new DescriptorFailure(502, 'Descriptor demasiado grande.'); }
      if (!response.body) throw new DescriptorFailure(502, 'Descriptor vacío.');
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > MAX_XML_BYTES) { await reader.cancel(); throw new DescriptorFailure(502, 'Descriptor demasiado grande.'); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    } catch (error) {
      if (error instanceof DescriptorFailure) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) throw new DescriptorFailure(504, 'Se agotó el tiempo de consulta del descriptor.');
      if (error instanceof TypeError && /encoded data|encoding/i.test(error.message)) throw new DescriptorFailure(502, 'Codificación XML no válida.');
      throw new DescriptorFailure(503, 'No fue posible consultar el descriptor del proveedor.');
    }
  }
  private async load<T>(source: string, sourceUrl: string, parse: (xml: string) => { data: T; warnings: string[] }): Promise<Envelope<T>> {
    const cached = this.cache.get(sourceUrl); const age = cached ? this.now() - cached.storedAt : Infinity;
    if (cached && age >= 0 && age < this.ttlMs) return { ...(cached.envelope as Envelope<T>), meta: { ...cached.envelope.meta, fromCache: true } };
    const inFlight = this.pending.get(sourceUrl); if (inFlight) return inFlight as Promise<Envelope<T>>;
    const task = (async (): Promise<Envelope<T>> => {
      let failure = new DescriptorFailure(503, 'Descriptor no disponible.');
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await this.sleep(attempt * 1000);
        try {
          const xml = await this.readDescriptor(sourceUrl);
          let parsed: { data: T; warnings: string[] };
          try { parsed = parse(xml); } catch { throw new DescriptorFailure(502, 'El proveedor devolvió un descriptor XML inválido o un contrato inesperado.'); }
          const obtainedAt = new Date(this.now()).toISOString();
          const envelope: Envelope<T> = { data: parsed.data, meta: { source, sourceUrl, obtainedAt, status: 'ok', fromCache: false, warnings: parsed.warnings } };
          this.cache.set(sourceUrl, { envelope, storedAt: this.now() });
          this.states.set(sourceUrl,{id:sourceUrl===SUNAT_WSDL_URL?'SUNAT':'SENAMHI-WFS',name:sourceUrl===SUNAT_WSDL_URL?'SUNAT · descriptor SOAP':'SENAMHI · capacidades WFS',sourceUrl,status:'ok',lastChecked:obtainedAt,lastSuccess:obtainedAt,detail:'Descriptor público consultado y validado; no se ejecutaron operaciones de escritura.'});
          return envelope;
        } catch (error) {
          failure = error instanceof DescriptorFailure ? error : new DescriptorFailure(503, 'Descriptor no disponible.');
          // A malformed contract cannot become valid by replaying the same request.
          if (failure.code === 502) break;
        }
      }
      const fallbackAge = cached ? this.now() - cached.storedAt : Infinity;
      const usable=Boolean(cached&&fallbackAge>=0&&fallbackAge<=this.staleMs);
      this.states.set(sourceUrl,{id:sourceUrl===SUNAT_WSDL_URL?'SUNAT':'SENAMHI-WFS',name:sourceUrl===SUNAT_WSDL_URL?'SUNAT · descriptor SOAP':'SENAMHI · capacidades WFS',sourceUrl,status:usable?'degraded':'unavailable',lastChecked:new Date(this.now()).toISOString(),lastSuccess:cached?.envelope.meta.obtainedAt??null,detail:usable?'Falló la actualización; se conserva el último descriptor real fechado.':failure.message});
      if (cached && fallbackAge >= 0 && fallbackAge <= this.staleMs) return { ...(cached.envelope as Envelope<T>), meta: { ...cached.envelope.meta, status: 'degraded', fromCache: true, warnings: [...cached.envelope.meta.warnings, `No fue posible actualizar el descriptor (HTTP ${failure.code}). Se conserva una respuesta real con su fecha de obtención.`] } };
      const body = { statusCode: failure.code, message: failure.message, source, sourceUrl, status: 'unavailable', obtainedAt: cached?.envelope.meta.obtainedAt ?? null, warnings: ['No se publican operaciones ni capas inventadas cuando el descriptor no está disponible.'] };
      if (failure.code === 502) throw new BadGatewayException(body);
      if (failure.code === 504) throw new GatewayTimeoutException(body);
      throw new ServiceUnavailableException(body);
    })();
    this.pending.set(sourceUrl, task as Promise<Envelope<unknown>>);
    try { return await task; } finally { this.pending.delete(sourceUrl); }
  }
}
