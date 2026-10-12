import {mkdir,writeFile} from 'node:fs/promises';

const origin=(process.env.SIGRA_API_URL||'http://127.0.0.1:3001').replace(/\/$/,'');
const headers=process.env.SIGRA_API_KEY?{'X-API-Key':process.env.SIGRA_API_KEY}:{};
const evidence={checkedAt:new Date().toISOString(),api:origin,checks:[]};
async function check(id,path,validate,base=origin){
 const started=Date.now();const url=`${base}/api/v1/${path}`;
 try{
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(90000)});
  const body=await response.json();
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${typeof body.message==='string'?body.message:'consulta fallida'}`);
  if(!validate(body))throw new Error('La respuesta no cumple el contrato esperado.');
  const record={id,url,ok:true,httpStatus:response.status,durationMs:Date.now()-started,response:body};
  evidence.checks.push(record);
  console.log(JSON.stringify({id,ok:true,source:body.meta?.source,status:body.meta?.status,obtainedAt:body.meta?.obtainedAt,fromCache:body.meta?.fromCache,durationMs:record.durationMs}));
  return body;
 }catch(error){
  const message=error instanceof Error?error.message:'Consulta fallida.';
  evidence.checks.push({id,url,ok:false,durationMs:Date.now()-started,error:message});
  console.error(JSON.stringify({id,ok:false,error:message}));
  return null;
 }
}
const envelope=body=>body&&body.meta&&['ok','degraded'].includes(body.meta.status)&&Number.isFinite(Date.parse(body.meta.obtainedAt))&&Array.isArray(body.meta.warnings);
const events=await check('SIG-01','sismos?dias=7&mag_min=0',body=>envelope(body)&&Array.isArray(body.data)&&body.data.length>0&&body.data.every(event=>typeof event.id==='string'&&Number.isFinite(event.lat)&&Number.isFinite(event.lon)));
await check('SIG-02','hidrologia/estaciones',body=>envelope(body)&&Array.isArray(body.data)&&body.data.length>0);
await check('SIG-03','glaciares/lagunas',body=>envelope(body)&&Array.isArray(body.data)&&body.data.length>0);
const event=events?.data[0];
if(event){
 await check('SIG-05',`meteorologia/actual?lat=${event.lat}&lon=${event.lon}`,body=>envelope(body)&&[body.data?.temperature,body.data?.precipitation,body.data?.wind].every(Number.isFinite));
 const panorama=await check('SIG-06',`riesgo/panorama?evento_id=${encodeURIComponent(event.id)}`,body=>envelope(body)&&body.data?.event?.id===event.id&&body.data.factors?.length===5&&Array.isArray(body.data.sources)&&body.data.index!==null&&!body.data.partial&&body.data.sources.every(source=>source.status==='ok'));
 if(panorama?.data.district?.ubigeo)await check('SIG-04',`poblacion/${panorama.data.district.ubigeo}`,body=>envelope(body)&&body.data?.ubigeo===panorama.data.district.ubigeo&&Number.isInteger(body.data.population)&&body.data.measure==='identified_dni');
 else evidence.checks.push({id:'SIG-04',ok:false,error:'No se obtuvo el ubigeo real de la consulta compuesta.'});
}else{
 for(const id of ['SIG-04','SIG-05','SIG-06'])evidence.checks.push({id,ok:false,error:'No se obtuvo un evento real para comprobar la composición.'});
}
await check('SIG-08','catalogo/contrato-soap',body=>envelope(body)&&body.data?.descriptorOnly===true&&body.data.operations?.length>0);
await check('SIG-09','catalogo/contrato-wfs',body=>envelope(body)&&body.data?.version==='2.0.0'&&body.data.layers?.length>0&&typeof body.data.hydrologicalLayer==='string');
await check('SIG-07','catalogo/servicios',body=>envelope(body)&&body.data?.length===9&&body.data.every(service=>service.integration==='implemented'&&service.availability?.status==='ok'));
await check('OpenAPI','openapi.json',body=>body.openapi==='3.1.0'&&Object.values(body.paths||{}).filter(path=>path.get?.['x-sigra-service']).length===9);
const webOrigin=(process.env.SIGRA_WEB_URL||'http://127.0.0.1:5173').replace(/\/$/,'');
await check('Web → API','sismos?dias=7&mag_min=0',body=>envelope(body)&&Array.isArray(body.data)&&body.data.length>0,webOrigin);
await mkdir('output',{recursive:true});
const file=`output/connections-live-${evidence.checkedAt.slice(0,10)}.json`;
await writeFile(file,JSON.stringify(evidence,null,2),'utf8');
const failed=evidence.checks.filter(item=>!item.ok);
console.log(JSON.stringify({passed:evidence.checks.length-failed.length,failed:failed.length,evidence:file}));
if(failed.length)process.exitCode=1;
