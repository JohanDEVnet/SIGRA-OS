import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
interface RequestLike { method:string; path?:string; ip?:string; headers:Record<string,string|string[]|undefined>; socket:{remoteAddress?:string} }
interface ResponseLike { statusCode:number; setHeader(name:string,value:string|number):void; status(code:number):ResponseLike; json(body:unknown):unknown; once(event:'finish',callback:()=>void):unknown }
export function createApiGuard(options:{apiKey?:string;limit?:number;windowMs?:number;now?:()=>number;log?:(entry:unknown)=>void}={}) {
 const limit=options.limit??60;const windowMs=options.windowMs??60_000;const now=options.now??Date.now;
 const clients=new Map<string,{count:number;reset:number}>();let nextCleanup=0;
 const expected=options.apiKey?createHash('sha256').update(options.apiKey).digest():null;
 return (request:RequestLike,response:ResponseLike,next:()=>void)=>{
  const started=now();const id=randomUUID();response.setHeader('X-Request-ID',id);
  response.once('finish',()=>options.log?.({requestId:id,path:request.path??'',status:response.statusCode,durationMs:now()-started}));
  if(request.method==='OPTIONS'||request.path==='/api/v1/health')return next();
  if(expected){const key=request.headers['x-api-key'];if(typeof key!=='string'||key.length>1024||!timingSafeEqual(expected,createHash('sha256').update(key).digest()))return response.status(401).json({statusCode:401,message:'Se requiere una API Key válida.',requestId:id});}
  if(started>=nextCleanup){for(const [client,bucket] of clients)if(bucket.reset<=started)clients.delete(client);nextCleanup=started+windowMs;}
  const client=request.ip??request.socket.remoteAddress??'unknown';let bucket=clients.get(client);
  if(!bucket||bucket.reset<=started){if(clients.size>=10_000)return response.status(503).json({statusCode:503,message:'La API está ocupada. Inténtalo nuevamente.',requestId:id});bucket={count:0,reset:started+windowMs};clients.set(client,bucket);}
  bucket.count++;response.setHeader('RateLimit-Limit',limit);response.setHeader('RateLimit-Remaining',Math.max(0,limit-bucket.count));response.setHeader('RateLimit-Reset',Math.ceil(bucket.reset/1000));
  if(bucket.count>limit){response.setHeader('Retry-After',Math.max(1,Math.ceil((bucket.reset-started)/1000)));return response.status(429).json({statusCode:429,message:'Se alcanzó el límite de 60 consultas por minuto. Espera antes de consultar nuevamente.',requestId:id});}
  next();
 };
}
