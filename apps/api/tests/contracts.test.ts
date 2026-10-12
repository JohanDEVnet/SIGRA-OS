import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { ContractsService, HYDROLOGICAL_LAYER, parseSoapDescriptor, parseWfsCapabilities, SENAMHI_CAPABILITIES_URL, SUNAT_WSDL_URL } from '../src/contracts.js';

const wsdl = readFileSync(new URL('../../../docs/sources/sunat-billservice.wsdl', import.meta.url), 'utf8').replace(/^\uFEFF/, '');
const capabilities = readFileSync(new URL('../../../docs/sources/senamhi-capabilities.xml', import.meta.url), 'utf8').replace(/^\uFEFF/, '');

test('WSDL real SUNAT conserva acciones, binding SOAP y puertos sin ejecutar operaciones', () => {
  const result = parseSoapDescriptor(wsdl);
  assert.deepEqual(result.data.operations.map((operation) => operation.name), ['getStatus', 'getStatusAR', 'sendBill', 'sendPack', 'sendSummary']);
  assert.equal(result.data.operations.find((operation) => operation.name === 'sendBill')?.soapAction, 'urn:sendBill');
  assert.equal(result.data.bindings[0].protocol, 'SOAP 1.1');
  assert.equal(result.data.bindings[0].style, 'document');
  assert.equal(result.data.services[0].ports[0].address, 'https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService');
  assert.equal(result.data.imports[0].location, 'billService?ns1.wsdl');
  assert.equal(result.data.descriptorOnly, true);
  assert.match(result.warnings.join(' '), /sin descargarlos/);
  const renamed = wsdl.replaceAll('wsdl:', 'contract:').replace('xmlns:wsdl=', 'xmlns:contract=').replaceAll('soap11:', 's:').replace('xmlns:soap11=', 'xmlns:s=');
  assert.deepEqual(parseSoapDescriptor(renamed).data.operations, result.data.operations);
});

test('GetCapabilities real publica formatos, endpoints y capa hidrológica sin inventarlos', () => {
  const result = parseWfsCapabilities(capabilities);
  assert.equal(result.data.version, '2.0.0');
  assert.equal(result.data.hydrologicalLayer, HYDROLOGICAL_LAYER);
  assert.ok(result.data.layers.length > 100);
  assert.equal(result.data.layers.find((layer) => layer.name === HYDROLOGICAL_LAYER)?.title, 'ESTACIONES HIDROLÓGICAS');
  assert.ok(result.data.formats.includes('application/json'));
  const getFeature = result.data.operations.find((operation) => operation.name === 'GetFeature');
  assert.ok(getFeature?.getUrls.includes('https://idesep.senamhi.gob.pe:443/geoserver/wfs'));
  assert.ok(getFeature?.postUrls.includes('https://idesep.senamhi.gob.pe:443/geoserver/wfs'));
  assert.ok(result.data.operations.some((operation) => operation.name === 'Transaction'));
  assert.match(result.warnings.join(' '), /no ejecuta transacciones/);
});

test('XML no expande entidades y rechaza DTD, namespaces falsos y documentos de excepción', () => {
  assert.throws(() => parseSoapDescriptor('<!DOCTYPE a [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' + wsdl));
  assert.throws(() => parseWfsCapabilities('<!DOCTYPE a [<!ENTITY a "boom">]>' + capabilities));
  assert.throws(() => parseSoapDescriptor(wsdl.replace('xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"', 'xmlns:wsdl="https://otro.example/wsdl"')));
  assert.throws(() => parseWfsCapabilities('<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1"><ows:Exception exceptionCode="NoApplicableCode"/></ows:ExceptionReport>'));
  assert.throws(() => parseSoapDescriptor('<not-closed>'));
  assert.throws(() => parseWfsCapabilities(' '));
});

test('catálogo solo descarga los descriptores GET y comparte peticiones concurrentes', async () => {
  const requests: { url: string; method: string | undefined }[] = [];
  const service = new ContractsService(async (url, init) => {
    requests.push({ url: String(url), method: init?.method });
    assert.ok(init?.signal);
    return new Response(String(url) === SUNAT_WSDL_URL ? wsdl : capabilities, { headers: { 'content-type': 'text/xml' } });
  });
  assert.ok(service.sourceStates().every(state=>state.status==='not-queried'&&state.lastChecked===null));
  const [soap, sameSoap] = await Promise.all([service.soapDescriptor(), service.soapDescriptor()]);
  assert.equal(service.sourceStates().find(state=>state.id==='SUNAT')?.status,'ok');
  assert.equal(service.sourceStates().find(state=>state.id==='SENAMHI-WFS')?.status,'not-queried');
  const wfs = await service.wfsCapabilities();
  assert.equal(service.sourceStates().find(state=>state.id==='SENAMHI-WFS')?.status,'ok');
  assert.deepEqual(soap.data, sameSoap.data);
  assert.equal(wfs.meta.source, 'SENAMHI');
  assert.deepEqual(requests, [{ url: SUNAT_WSDL_URL, method: 'GET' }, { url: SENAMHI_CAPABILITIES_URL, method: 'GET' }]);
  const cached = await service.soapDescriptor();
  assert.equal(cached.meta.fromCache, true);
  assert.equal(cached.meta.obtainedAt, soap.meta.obtainedAt);
  assert.equal(requests.length, 2);
});

test('fallo externo reintenta 1/2s y conserva solo un descriptor real fechado dentro del límite', async () => {
  let now = Date.parse('2026-10-12T02:00:00Z'); let fail = false; let calls = 0; const delays: number[] = [];
  const service = new ContractsService(async () => { calls++; if (fail) throw new TypeError('fetch failed'); return new Response(wsdl); }, () => now, { ttlMs: 10, staleMs: 100, sleep: async (delay) => { delays.push(delay); } });
  const original = await service.soapDescriptor();
  fail = true; now += 11;
  const degraded = await service.soapDescriptor();
  assert.equal(degraded.meta.status, 'degraded');
  const state=service.sourceStates().find(state=>state.id==='SUNAT')!;
  assert.equal(state.status,'degraded');
  assert.equal(state.lastSuccess,original.meta.obtainedAt);
  assert.equal(state.lastChecked,new Date(now).toISOString());
  assert.equal(degraded.meta.fromCache, true);
  assert.equal(degraded.meta.obtainedAt, original.meta.obtainedAt);
  assert.deepEqual(degraded.data, original.data);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [1000, 2000]);
  now += 101;
  await assert.rejects(service.soapDescriptor(), ServiceUnavailableException);
  assert.equal(service.sourceStates().find(state=>state.id==='SUNAT')?.status,'unavailable');
});

test('timeout, XML inválido y respuesta demasiado grande conservan códigos 504/502', async () => {
  let timeoutCalls = 0;
  const timeout = new ContractsService(async () => { timeoutCalls++; throw new DOMException('timeout', 'TimeoutError'); }, Date.now, { sleep: async () => {} });
  await assert.rejects(timeout.soapDescriptor(), GatewayTimeoutException);
  assert.equal(timeoutCalls, 3);
  let invalidCalls = 0;
  const invalid = new ContractsService(async () => { invalidCalls++; return new Response('<html>Proveedor temporalmente fuera de servicio</html>'); }, Date.now, { sleep: async () => {} });
  await assert.rejects(invalid.soapDescriptor(), BadGatewayException);
  assert.equal(invalidCalls, 1);
  const oversized = new ContractsService(async () => new Response('a'.repeat(2 * 1024 * 1024 + 1)), Date.now, { sleep: async () => {} });
  await assert.rejects(oversized.soapDescriptor(), BadGatewayException);
});
