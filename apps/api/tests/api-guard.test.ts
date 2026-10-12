import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiGuard } from '../src/api-guard.js';
function response(){return {statusCode:200,headers:new Map<string,string|number>(),body:null as unknown,setHeader(name:string,value:string|number){this.headers.set(name,value);},status(code:number){this.statusCode=code;return this;},json(body:unknown){this.body=body;return this;},once(){return this;}};}
const request=(ip='127.0.0.1',key?:string)=>({method:'GET',path:'/api/v1/sismos',ip,headers:{'x-api-key':key},socket:{remoteAddress:ip}});
test('límite60 por cliente, Retry-After y recuperación tras la ventana',()=>{
 let time=0;const guard=createApiGuard({now:()=>time});let accepted=0;
 for(let i=0;i<60;i++)guard(request(),response(),()=>accepted++);
 assert.equal(accepted,60);const denied=response();guard(request(),denied,()=>accepted++);assert.equal(denied.statusCode,429);assert.equal(denied.headers.get('Retry-After'),60);
 guard(request('127.0.0.2'),response(),()=>accepted++);assert.equal(accepted,61);time=60_001;guard(request(),response(),()=>accepted++);assert.equal(accepted,62);
});
test('API Key es opcional y se verifica cuando se configura; health queda abierto',()=>{
 let accepted=0;createApiGuard()(request(),response(),()=>accepted++);assert.equal(accepted,1);
 const protectedGuard=createApiGuard({apiKey:'clave-controlada-prueba'});const denied=response();protectedGuard(request(),denied,()=>accepted++);assert.equal(denied.statusCode,401);
 const wrong=response();protectedGuard(request('127.0.0.1','incorrecta'),wrong,()=>accepted++);assert.equal(wrong.statusCode,401);
 protectedGuard(request('127.0.0.1','clave-controlada-prueba'),response(),()=>accepted++);assert.equal(accepted,2);
 protectedGuard({...request(),path:'/api/v1/health'},response(),()=>accepted++);assert.equal(accepted,3);
});
