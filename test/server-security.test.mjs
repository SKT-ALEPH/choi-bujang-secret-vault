import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createAccessServer} from '../server-security/server-a.mjs';
import {createAssessmentServer} from '../server-security/server-b.mjs';
import {openStore} from '../server-security/store.mjs';
import {packet,unpack,sha,checkAssessment,jsonBody,send} from '../server-security/common.mjs';
import {signGatewayRequest,verifyGatewayRequest} from '../src/netbird-gateway.mjs';
import {sealBackup,openBackup} from '../server-security/backup.mjs';
import {createGatewayContextHandler} from '../api/gateway-context.js';
import {requestMessage} from '../public/device-message.mjs';
import policyDefault from '../server-security/policy.local.json' with {type:'json'};

const keys=()=>generateKeyPairSync('ed25519');
const pem=key=>key.export({format:'pem',type:'spki'});
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;};
const close=async s=>{s.closeAllConnections();await new Promise(r=>s.close(r));};
async function fixture(t,{policy={},ai}={}){
  const a=keys(),b=keys(),w=keys(),aStore=openStore(':memory:'),bStore=openStore(':memory:');
  const p={...policyDefault,...policy};
  const state={subjectId:randomUUID(),sessionId:randomUUID(),deviceCredentialId:randomUUID(),revoked:false,version:1,webCalls:0,steps:[],onContext:null,delayWeb:0};
  const web=createServer(async(req,res)=>{
    if(req.url==='/api/security-key'){if(state.delayKey)await new Promise(r=>setTimeout(r,state.delayKey));send(res,200,{schema:'keshev.web-key.v1',publicKey:pem(w.publicKey)});return;}
    let data;if(req.method==='POST')data=await jsonBody(req);
    const original={method:req.method,url:req.url,headers:req.headers,body:data};
    if(!verifyGatewayRequest(original,{required:true,publicKey:pem(a.publicKey)})){send(res,403,{error:'NETBIRD_GATEWAY_REQUIRED'});return;}
    if(req.url==='/api/auth?path=otp'){state.steps.push('otp');send(res,200,{});return;}
    if(req.url==='/api/auth?path=verify'){
      state.steps.push('verify');assert.equal(data.token,'123456');assert.equal(data.email,'fixture@example.invalid');
      send(res,200,{access_token:'synthetic-test-token',refresh_token:'synthetic-test-refresh',user:{email:'fixture@example.invalid'}});return;
    }
    if(req.url==='/api/gateway-context'){
      state.steps.push('context');state.onContext?.();
      if(state.revoked){send(res,403,{error:'DEVICE_NOT_APPROVED'});return;}
      if(state.deleted&&!data.completedDelete){send(res,403,{error:'RESOURCE_NOT_AUTHORIZED'});return;}
      send(res,200,{schema:'keshev.gateway.context.v1',subjectId:state.subjectId,sessionId:state.sessionId,deviceCredentialId:state.deviceCredentialId,
        resource:data.path.split('?')[0],operation:data.method,stepUp:false,expiresAt:new Date(Date.now()+60000).toISOString(),stateVersion:sha(String(state.version))});return;
    }
    state.webCalls++;state.steps.push('web');if(state.delayWeb)await new Promise(r=>setTimeout(r,state.delayWeb));
    const result=req.method==='DELETE'?{id:new URL(req.url,'http://fixture.invalid').searchParams.get('id'),deleted:true}:[{id:randomUUID(),title:'Synthetic test',body:'Synthetic fixture only'}];
    if(req.method==='DELETE')state.deleted=true;
    const event={schema:'keshev.web.event.v1',eventId:randomUUID(),requestId:req.headers['x-keshev-request-id'],contextDigest:req.headers['x-keshev-context'],subjectId:state.subjectId,status:200,records:Array.isArray(result)?result.length:1,bytes:Buffer.byteLength(JSON.stringify(result)),responseDigest:sha(JSON.stringify(result)),observedAt:new Date().toISOString()};
    send(res,200,result,{'x-keshev-web-event':Buffer.from(JSON.stringify(packet(w.privateKey,'web-event',event))).toString('base64url')});
  });
  const webOrigin=await listen(web);
  const B=createAssessmentServer({store:bStore,privateKey:b.privateKey,aPublicKey:pem(a.publicKey),policy:p,webOrigin,ai});
  const bOrigin=await listen(B.server);
  const A=createAccessServer({store:aStore,privateKey:a.privateKey,bPublicKey:pem(b.publicKey),policy:p,webOrigin,bOrigin,allowLocal:true,serveFiles:false});
  const aOrigin=await listen(A.server);
  t.after(async()=>{await close(A.server);await close(B.server);await close(web);aStore.close();bStore.close();});
  const input=(overrides={})=>({method:'GET',path:'/api/my/notes',headers:{authorization:'Bearer synthetic.token.only','x-aleph-device':state.deviceCredentialId,'x-aleph-at':String(Date.now()),'x-aleph-nonce':randomUUID(),'x-aleph-signature':'test-fixture-only'},body:'',...overrides});
  return {a,b,w,A,B,state,p,aStore,bStore,input,webOrigin,bOrigin,aOrigin};
}

test('central A waits for authenticated B then rechecks authority before the actual web request',async t=>{
  const f=await fixture(t);
  const r=await f.A.relay(f.input());assert.equal(r.status,200);assert.equal(f.state.webCalls,1);
  assert.deepEqual(f.state.steps,['context','context','web','context']);
  assert.equal(f.bStore.db.prepare("SELECT count(*) n FROM events WHERE source='web-api'").get().n,1);
  assert.ok(f.bStore.db.prepare("SELECT count(*) n FROM events WHERE source='server-b'").get().n>=1);
  const all=JSON.stringify(f.bStore.db.prepare('SELECT data FROM events').all());
  assert.ok(!all.includes('synthetic.token.only'));assert.ok(!all.includes('Synthetic fixture only'));
});
test('A exposes normal email authentication without a stored password and rejects anonymous protected access',async t=>{
  const f=await fixture(t);
  const missing=await fetch(f.aOrigin+'/api/my/notes');assert.equal(missing.status,401);assert.equal((await missing.json()).error,'LOGIN_REQUIRED');assert.deepEqual(f.state.steps,[]);
  const submit=input=>fetch(f.aOrigin+'/api/netbird/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
  assert.equal((await submit({operation:'login',email:'fixture@example.invalid'})).status,200);
  const verified=await submit({operation:'verify',email:'fixture@example.invalid',tokenHash:'123456'});
  assert.equal(verified.status,200);assert.equal((await verified.json()).user.email,'fixture@example.invalid');
  assert.equal((await submit({operation:'verify',email:'fixture@example.invalid',tokenHash:'invalid'})).status,400);
  assert.deepEqual(f.state.steps,['otp','verify']);assert.equal(f.state.webCalls,0);
});
test('successful deletion rechecks current login and device without requiring the removed note to still exist',async t=>{
  const f=await fixture(t),id=randomUUID();
  const r=await f.A.relay(f.input({method:'DELETE',path:'/api/notes/'+id}));
  assert.equal(r.status,200);assert.deepEqual(r.data,{id,deleted:true});assert.equal(f.state.deleted,true);
  assert.deepEqual(f.state.steps,['context','context','web','context']);
});
test('B unavailable fails closed without sending a protected request',async t=>{
  const f=await fixture(t);await close(f.B.server);
  await assert.rejects(f.A.relay(f.input()));assert.equal(f.state.webCalls,0);
});
test('revocation while B evaluates prevents delivery to the web server',async t=>{
  const f=await fixture(t,{policy:{aiRequired:true},ai:async()=>{f.state.revoked=true;return {riskLevel:'low',recommendedControl:'none',reasonCodes:['NORMAL_REQUEST'],evidenceIds:[]};}});
  await assert.rejects(f.A.relay(f.input()),{code:'DEVICE_NOT_APPROVED'});assert.equal(f.state.webCalls,0);
});
test('AI missing or unknown cannot become a low-risk permission',async t=>{
  const f=await fixture(t,{policy:{aiRequired:true}});
  await assert.rejects(f.A.relay(f.input()),{code:'ASSESSMENT_UNKNOWN'});assert.equal(f.state.webCalls,0);
});
test('known CVE syntax is denied by B before any write and the scoped block can be reviewed and recovered',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.A.relay(f.input({method:'POST',path:'/api/notes',headers:{...f.input().headers,'content-type':'application/json'},body:JSON.stringify({title:'Synthetic',body:'${jndi:ldap://example.invalid/test}'})})),{code:'XDR_ACCESS_DENIED'});
  assert.equal(f.state.webCalls,0);
  const blocked=f.aStore.db.prepare('SELECT * FROM restrictions').get();assert.equal(blocked.subject,f.state.subjectId);
  await assert.rejects(f.A.relay(f.input({path:'/api/notes'})),{code:'ACCESS_REVOKED'});
  f.aStore.db.prepare('UPDATE restrictions SET released=? WHERE id=?').run(Date.now(),blocked.id);
  assert.equal((await f.A.relay(f.input({path:'/api/notes'}))).status,200);
});
test('B durably accepts an authenticated recovery approval as a proposal, preserving the actual access result separately',async t=>{
  const f=await fixture(t),event={eventId:randomUUID(),requestId:randomUUID(),subjectId:f.state.subjectId,sessionId:f.state.sessionId,deviceCredentialId:f.state.deviceCredentialId,resource:'/api/notes',kind:'recovery-approved',status:202,bytes:0,reasonCode:'LOCAL_OPERATOR_REVIEW',contextDigest:sha('synthetic approval context'),webEvent:null};
  const r=await fetch(f.bOrigin+'/internal/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(packet(f.a.privateKey,'/internal/events',event))});
  assert.equal(r.status,200);const saved=JSON.parse(f.bStore.db.prepare('SELECT data FROM events WHERE id=?').get(event.eventId).data);
  assert.equal(saved.kind,'recovery-approved');assert.equal(saved.status,202);assert.equal(f.state.webCalls,0);
});
test('concurrent authenticated delivery during a cold web-key fetch stores one event and acknowledges both senders',async t=>{
  const f=await fixture(t);f.state.delayKey=40;
  const requestId=randomUUID(),contextDigest=sha('synthetic concurrent delivery'),web={schema:'keshev.web.event.v1',eventId:randomUUID(),requestId,contextDigest,subjectId:f.state.subjectId,status:200,records:0,bytes:2,responseDigest:sha('[]'),observedAt:new Date().toISOString()};
  const event={eventId:randomUUID(),requestId,subjectId:f.state.subjectId,sessionId:f.state.sessionId,deviceCredentialId:f.state.deviceCredentialId,resource:'/api/my/notes',kind:'access-result',status:200,bytes:2,reasonCode:'NORMAL_REQUEST',contextDigest,webEvent:packet(f.w.privateKey,'web-event',web)};
  const deliver=()=>fetch(f.bOrigin+'/internal/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(packet(f.a.privateKey,'/internal/events',event))});
  const results=await Promise.all([deliver(),deliver()]);assert.deepEqual(results.map(r=>r.status),[200,200]);
  assert.equal(f.bStore.db.prepare('SELECT count(*) n FROM events WHERE id IN (?,?)').get(event.eventId,web.eventId).n,2);
});
test('atomic reservation prevents parallel requests from exceeding the response budget',async t=>{
  const f=await fixture(t,{policy:{maxConcurrent:1}});f.state.delayWeb=100;
  const results=await Promise.allSettled([f.A.relay(f.input()),f.A.relay(f.input())]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.state.webCalls,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'ACCESS_BUDGET_EXCEEDED');
});
test('B-to-A proof replay and response substitution are rejected',()=>{
  const k=keys(),seen=new Set(),p=packet(k.privateKey,'/internal/evaluate',{requestId:randomUUID()});
  const consume=n=>{if(seen.has(n))throw Error('replay');seen.add(n);};
  unpack(pem(k.publicKey),'/internal/evaluate',p,consume);
  assert.throws(()=>unpack(pem(k.publicKey),'/internal/evaluate',p,consume));
  const other=structuredClone(p);other.value.data.requestId=randomUUID();assert.throws(()=>unpack(pem(k.publicKey),'/internal/evaluate',other,()=>{}));
});
test('A binds the maximum returned record count into gateway proof v2',()=>{
  const k=keys(),headers={authorization:'Bearer synthetic','x-keshev-request-id':randomUUID(),'x-keshev-context':sha('context'),'x-keshev-max-records':'1'};
  const req={method:'GET',url:'/api/my/notes',headers};Object.assign(headers,signGatewayRequest(k.privateKey,req));
  assert.equal(verifyGatewayRequest(req,{required:true,publicKey:pem(k.publicKey)}),true);
  headers['x-keshev-max-records']='100';assert.equal(verifyGatewayRequest(req,{required:true,publicKey:pem(k.publicKey)}),false);
});
test('the retired employee gateway key cannot bypass central A for protected vault routes or aliases',()=>{
  const old=keys(),central=keys(),id=randomUUID();
  const settings={required:true,publicKey:pem(old.publicKey),publicKeys:[pem(old.publicKey),pem(central.publicKey)],centralPublicKeys:[pem(central.publicKey)],centralRequiredPaths:['/api/notes','/api/my/notes','/api/announcements','/api/restore','/api/device','/api/gateway-context']};
  for(const url of ['/api/notes','/notes/'+id,'/api/my/notes','/my/notes','/api/announcements/'+id,'/api/restore/'+id,'/api/device?operation=status','/api/gateway-context']){
    const request={method:'GET',url,headers:{authorization:'Bearer synthetic'}};
    Object.assign(request.headers,signGatewayRequest(old.privateKey,request));assert.equal(verifyGatewayRequest(request,settings),false,url);
    Object.assign(request.headers,signGatewayRequest(central.privateKey,request));assert.equal(verifyGatewayRequest(request,settings),true,url);
  }
  const historical={method:'GET',url:'/api/threat-intel?component=node&page=0',headers:{authorization:'Bearer synthetic'}};
  Object.assign(historical.headers,signGatewayRequest(old.privateKey,historical));assert.equal(verifyGatewayRequest(historical,settings),true);
});
test('assessment requires current request, policy, valid time and allowlisted controls',()=>{
  const p=policyDefault,request={requestId:randomUUID(),contextDigest:sha('context')},now=Date.now();
  const a={schema:'keshev.risk.assessment.v1',assessmentId:randomUUID(),...request,policyVersion:p.version,riskLevel:'low',recommendedControl:'none',reasonCodes:['NORMAL_REQUEST'],evidenceIds:[],evaluatedAt:new Date(now).toISOString(),validUntil:new Date(now+1000).toISOString()};
  assert.equal(checkAssessment(a,request,p),a);
  for(const delta of [{requestId:randomUUID()},{contextDigest:sha('different')},{policyVersion:'old'},{validUntil:new Date(now-1).toISOString()},{recommendedControl:'allow-all'},{reasonCodes:['RUN_SHELL']}])assert.throws(()=>checkAssessment({...a,...delta},request,p));
});
test('persistent scoped restriction survives reopening while another subject remains unaffected',()=>{
  const dir=mkdtempSync(join(tmpdir(),'keshev-central-')),path=join(dir,'state.sqlite');
  const c={subjectId:randomUUID(),sessionId:randomUUID(),deviceCredentialId:randomUUID(),resource:'/api/notes'};
  let s=openStore(path);s.restrict(c,{until:Date.now()+60000,evidenceId:randomUUID()});s.close();s=openStore(path);
  assert.equal(s.active(c).length,1);assert.equal(s.active({...c,subjectId:randomUUID()}).length,0);s.close();rmSync(dir,{recursive:true});
});
test('Wazuh ingress accepts registered company servers and drops raw private log content',async t=>{
  const f=await fixture(t),dir=mkdtempSync(join(tmpdir(),'keshev-wazuh-')),path=join(dir,'alerts.json');t.after(()=>rmSync(dir,{recursive:true}));
  f.bStore.db.prepare('INSERT INTO server_registry VALUES(?,?,1)').run('server-a','003');
  writeFileSync(path,[{id:'synthetic-server-observation',timestamp:new Date().toISOString(),agent:{id:'003'},rule:{id:'550',level:7,groups:['syscheck']},full_log:'PRIVATE FILE BODY'},
    {id:'unregistered',timestamp:new Date().toISOString(),agent:{id:'999'},rule:{id:'550',level:16,groups:['syscheck']}}].map(JSON.stringify).join('\n')+'\n');
  f.B.readWazuh(path);
  const rows=f.bStore.db.prepare("SELECT data FROM events WHERE source='wazuh'").all();assert.equal(rows.length,1);assert.ok(!JSON.stringify(rows).includes('PRIVATE FILE BODY'));
  await assert.rejects(f.A.relay(f.input()),{code:'XDR_ACCESS_DENIED'});assert.equal(f.state.webCalls,0);
});
test('audit backup is encrypted, restores exactly, and rejects tampering and another key',()=>{
  const plain=Buffer.from('synthetic audit database'),key='synthetic backup key',sealed=sealBackup(plain,key);
  assert.ok(!sealed.includes(plain));assert.deepEqual(openBackup(sealed,key),plain);
  assert.throws(()=>openBackup(sealed,'another key'));sealed[20]^=1;assert.throws(()=>openBackup(sealed,key));
});
test('real gateway context verifier checks the original device proof without consuming it and keeps current ownership/grants',async()=>{
  const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),subject=randomUUID(),device=randomUUID(),note=randomUUID(),other=randomUUID();
  const token='Bearer fixture.'+Buffer.from(JSON.stringify({session_id:randomUUID(),aal:'aal1'})).toString('base64url')+'.fixture';
  const tables={aleph_device_sessions:[{id:device,user_id:subject,public_jwk:pair.publicKey.export({format:'jwk'}),token_hash:sha(token),approved:true,expires_at:new Date(Date.now()+60000).toISOString()}],
    notes:[{id:note,owner_id:subject},{id:other,owner_id:randomUUID()}],announcement_editors:[{user_id:subject,announcement_id:note}]};
  const database={from(name){assert.notEqual(name,'aleph_device_nonces');const filters=[];const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},maybeSingle(){return q;},async abortSignal(){return {data:tables[name].find(r=>filters.every(f=>f(r)))??null,error:null};}};return q;}};
  const handler=createGatewayContextHandler(()=>({database,authorizeGateway:async req=>{req.keshevCentralGateway=req.testCentralGateway===true;return true;},verifyLoginAuthorization:async()=>({kind:'student',userId:subject})}));
  async function call(path,method='GET',extra={},central=false){
    const at=String(Date.now()),nonce=randomUUID(),bodyHash=sha('');
    const signature=sign('sha256',Buffer.from(requestMessage({id:device,at,nonce,method,path,bodyHash,tokenHash:sha(token)})),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
    let status,data;const res={setHeader(){},status(n){status=n;return res;},json(v){data=v;}};
    await handler({method:'POST',query:{},headers:{authorization:token},testCentralGateway:central,body:{method,path,bodyHash,deviceProof:{id:device,at,nonce,signature},...extra}},res);return {status,data};
  }
  assert.equal((await call('/api/notes?id='+note)).status,200);
  assert.equal((await call('/api/notes?id='+other)).status,403);
  assert.equal((await call('/api/notes',{},{role:'admin'})).status,400);
  assert.equal((await call('/api/announcements?id='+note,'PUT')).status,200);
  tables.announcement_editors=[];assert.equal((await call('/api/announcements?id='+note,'PUT')).status,403);
  assert.equal((await call('/api/restore?id='+note,'POST')).status,200);
  tables.notes=tables.notes.filter(r=>r.id!==note);
  assert.equal((await call('/api/notes?id='+note,'DELETE')).status,403);
  assert.equal((await call('/api/notes?id='+note,'DELETE',{completedDelete:true})).status,400);
  assert.equal((await call('/api/notes?id='+note,'GET',{completedDelete:true},true)).status,400);
  assert.equal((await call('/api/notes?id='+note,'DELETE',{completedDelete:true},true)).status,200);
  assert.equal((await call('/api/notes','DELETE',{completedDelete:true},true)).status,400);
  tables.aleph_device_sessions[0].approved=false;assert.equal((await call('/api/notes?id='+note)).status,403);
  assert.equal((await call('/api/notes?id='+note,'DELETE',{completedDelete:true},true)).status,403);
});
