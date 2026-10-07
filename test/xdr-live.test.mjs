import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveXdr, trustedVercelSource } from '../xdr/brute-force/live.mjs';
import { createAuthHandler } from '../api/auth.js';
import { createNotesHandler } from '../api/notes.js';

const response=()=>({headers:{},statusCode:null,body:null,setHeader(k,v){this.headers[k]=v;},
  status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const at='2026-10-07T09:30:00Z';
const makeDatabase=()=>{
  let failures=0,rule=null;const calls=[];
  return {calls,
    from(name){assert.equal(name,'xdr_sources');return {select(){return this;},eq(field,key){
      assert.equal(field,'source_key');assert.match(key,/^[a-f0-9]{64}$/);return this;},maybeSingle(){return this;},
      async abortSignal(){return {data:rule,error:null};}};},
    rpc(name,input){return {abortSignal:async()=>{
      calls.push({name,input});
      if(name==='xdr_failure') {
        assert.match(input.p_account_key,/^[a-f0-9]{64}$/);
        return {data:{at,windowStarted:at,failureCount:++failures,accountCount:1},error:null};
      }
      assert.equal(name,'xdr_apply');
      if(input.p_action==='block')rule={created_at:at,expires_at:'2026-10-07T09:45:00Z',
        confidence:input.p_confidence,evidence_ids:[input.p_alert_id]};
      return {error:null};
    }};},
  };
};

test('trusted source uses only Vercel edge context, never body, socket guesses or other forwarded headers',()=>{
  assert.equal(trustedVercelSource({headers:{'x-vercel-forwarded-for':'192.0.2.120'}},true),'192.0.2.120');
  for(const request of [{body:{ip:'192.0.2.120'}},{headers:{'x-forwarded-for':'192.0.2.120'}},
    {headers:{'x-vercel-forwarded-for':'192.0.2.120, 192.0.2.121'}}]) {
    assert.throws(()=>trustedVercelSource(request,true),/XDR_SOURCE_UNAVAILABLE/);
  }
  assert.throws(()=>trustedVercelSource({headers:{'x-vercel-forwarded-for':'192.0.2.120'}},false),/XDR_SOURCE_UNAVAILABLE/);
});

test('HTTP login failures feed the real guard and notes gate; expiry restores the previous pipeline',async()=>{
  const database=makeDatabase();let time=at;let upstreamCalls=0;
  const xdr=createLiveXdr({database,secret:'test-only',getSource:()=> '192.0.2.120',now:()=>time,askJev:async()=>null});
  const auth=createAuthHandler(async()=>{upstreamCalls++;return Response.json({error_code:'invalid_credentials'},{status:400});},
    {getXdr:()=>xdr});
  const request={method:'POST',query:{path:'token',grant_type:'password'},
    body:{email:'fictional@example.invalid',password:'test-only-password'}};
  for(let i=0;i<20;i++){const res=response();await auth(request,res);assert.equal(res.statusCode,400);}
  const blocked=response();await auth(request,blocked);assert.equal(blocked.statusCode,429);assert.equal(upstreamCalls,20);
  assert.equal(blocked.headers['Retry-After'],'900');
  assert.equal(JSON.stringify(database.calls).includes('fictional@example.invalid'),false);
  assert.equal(JSON.stringify(database.calls).includes('test-only-password'),false);
  assert.equal(JSON.stringify(database.calls).includes('192.0.2.120'),false);
  let noteReads=0;
  const noteDatabase={from(){noteReads++;return {select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},
    async abortSignal(){return {data:[],error:null};}};}};
  const notes=createNotesHandler(()=>({database:noteDatabase,xdr,verifyLoginAuthorization:async()=>({userId:'fixture'})}));
  const noteRequest={method:'GET',headers:{authorization:'Bearer test-only'}};
  const denied=response();await notes(noteRequest,denied);assert.equal(denied.statusCode,403);assert.equal(noteReads,0);
  const unsigned=response();await notes({method:'GET',headers:{}},unsigned);assert.equal(unsigned.statusCode,401);
  time='2026-10-07T09:45:00Z';
  const restored=response();await notes(noteRequest,restored);assert.equal(restored.statusCode,200);assert.equal(noteReads,1);
});

test('guard storage failure rejects access without falling back to the upstream or exposing diagnostics',async()=>{
  let called=false;const auth=createAuthHandler(async()=>{called=true;return Response.json({});},
    {getXdr:()=>({check:async()=>{throw new Error('private detail');}})});
  const res=response();await auth({method:'POST',query:{path:'token',grant_type:'password'},body:{}},res);
  assert.equal(res.statusCode,502);assert.equal(called,false);assert.equal(JSON.stringify(res.body).includes('private detail'),false);
});
