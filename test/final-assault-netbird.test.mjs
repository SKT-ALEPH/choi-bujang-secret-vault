import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readNetBirdObservation,overlayIp} from '../on-client/student/netbird-observation.mjs';
import {createDailyServer} from '../on-client/student/start-daily.mjs';
import {createResourceServer} from '../on-client/student/netbird-resource.mjs';
const target='100.100.10.2';
const status={cliVersion:'0.81.4',daemonStatus:'Connected',management:{connected:true},signal:{connected:true},peers:{total:1,connected:1,details:[{netbirdIp:target,publicKey:'private-extra'}]},publicKey:'private-extra',netbirdIp:'100.100.10.1'};
const run=async(exe,args,options)=>{assert.deepEqual(args,['status','--json']);assert.equal(options.timeout,4000);return {stdout:JSON.stringify(status)};};

test('only a known configured overlay peer is probed; status strips keys and addresses',async()=>{
 let calls=0;
 const request=async(url,options)=>{calls++;assert.equal(url,`http://${target}:54123/keshev-health`);assert.equal(options.redirect,'error');return new Response(JSON.stringify({ok:true,schema:'keshev.private-resource.v1',resource:'keshev-windows-check',servedAt:new Date().toISOString()}));};
 const d=await readNetBirdObservation({run,request,target});assert.equal(d.resource.status,'reachable');assert.equal(calls,1);
 assert.ok(!/private-extra|100\.100/.test(JSON.stringify(d)));
 for(const value of ['127.0.0.1','169.254.169.254','100.100.10.3','https://example.com',target+':80']){
  const denied=await readNetBirdObservation({run,request,target:value});assert.equal(denied.resource.status,'peer_unavailable');
 }
 assert.equal(calls,1);assert.equal(overlayIp('100.100.999.1'),false);
});
test('bad CLI, unavailable peer, bad/oversized HTTP response and timeout never become allow/deny judgments',async()=>{
 const bad=await readNetBirdObservation({run:async()=>{throw Error('private-diagnostics');},target});assert.equal(bad.status,'unavailable');assert.ok(!JSON.stringify(bad).includes('private-diagnostics'));
 for(const request of [async()=>{throw Error('timeout');},async()=>new Response('x'.repeat(2049)),async()=>new Response('{}'),async()=>new Response('{}',{status:403})]){
  const d=await readNetBirdObservation({run,request,target});assert.equal(d.resource.status,'unreachable');assert.ok(!('decision' in d));
 }
 const absent=await readNetBirdObservation({run,request:()=>assert.fail('must not probe'),target:''});assert.equal(absent.resource.status,'not_configured');
});
test('NetBird endpoint keeps same-origin session checks and original ALEPH disconnected mode',async()=>{
 const server=await createDailyServer({readNetBird:()=>({schema:'test-only'})});server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(origin+'/api/student/netbird')).status,403);
  assert.equal((await fetch(origin+'/api/student/netbird',{headers:{cookie,'sec-fetch-site':'cross-site'}})).status,403);
  const headers={cookie,'sec-fetch-site':'same-origin'};
  assert.equal((await fetch(origin+'/api/student/netbird',{method:'POST',headers})).status,405);
  assert.equal((await fetch(origin+'/api/student/netbird',{headers})).status,200);
  assert.equal((await (await fetch(origin+'/api/me')).json()).meta.mode,'disconnected');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('private resource rejects invalid bindings and unrelated clients, never exposes a file route',async()=>{
 assert.throws(()=>createResourceServer({bind:'0.0.0.0',client:target}));
 const server=createResourceServer({bind:'100.100.10.1',client:target});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{for(const path of ['/keshev-health','/../package.json']){const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`);assert.equal(r.status,403);assert.deepEqual(await r.json(),{ok:false});}}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
