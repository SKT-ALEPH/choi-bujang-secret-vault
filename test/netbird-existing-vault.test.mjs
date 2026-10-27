import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createAiHandler} from '../api/ai.js';
import {createThreatIntelHandler} from '../api/threat-intel.js';
import {createNotesHandler} from '../api/notes.js';
import {createDeviceHandler} from '../api/device.js';
import {createAuthHandler as createProductionAuthHandler} from '../api/auth.js';
const createAuthHandler=(fetch,options={})=>createProductionAuthHandler(fetch,{getPublishableKey:()=> 'fixture-only-public-key',...options});
import {authorizeDevice} from '../src/device-session.mjs';
import {authorizeGateway,signGatewayRequest,verifyGatewayRequest} from '../src/netbird-gateway.mjs';
import {enrollmentMessage,requestMessage} from '../public/device-message.mjs';
import {sha,createSigner} from '../personal-workspace/wire.mjs';
import {createResourceServer} from '../personal-workspace/resource.mjs';
import {createWorkspaceStore} from '../personal-workspace/store.mjs';
import {createWorkspaceServer} from '../personal-workspace/server.mjs';
import {createVaultGateway} from '../on-client/student/netbird-vault.mjs';
import {createManagedAccount} from '../on-client/student/managed-account.mjs';

const userA='00000000-0000-4000-8000-00000000000a',userB='00000000-0000-4000-8000-00000000000b';
// The token fixture must not change when setup crosses a wall-clock second.
const fixtureExpiresAt=Math.floor(Date.now()/1000)+3600;
const jwt=user=>'e30.'+Buffer.from(JSON.stringify({sub:user,exp:fixtureExpiresAt})).toString('base64url')+'.fixture';
test('account automation uses normal email OTP; no password generation, admin creation or confirmation bypass',async()=>{
 const calls=[],account=createManagedAccount({transport:async(path,input)=>{calls.push({path,input});return {status:200,data:input.path.endsWith('verify')?{user:{email:'fixture@example.invalid'}}:{}};}});
 await account({operation:'signup',email:'fixture@example.invalid'});assert.equal(calls[0].input.path,'/api/auth?path=otp');assert.equal(JSON.parse(calls[0].input.body).create_user,true);assert.equal(Object.hasOwn(JSON.parse(calls[0].input.body),'password'),false);
 assert.equal((await account({operation:'verify',email:'fixture@example.invalid',tokenHash:'a'.repeat(64)})).status,200);assert.equal(calls[1].input.path,'/api/auth?path=verify');assert.equal(JSON.parse(calls[1].input.body).type,'email');
 await assert.rejects(account({operation:'signup',email:'invalid'}));assert.equal(calls.length,2);
});
test('email verification cannot attach a different account',async()=>{
 const account=createManagedAccount({transport:async()=>({status:200,data:{access_token:'fixture',user:{email:'other@example.invalid'}}})});
 const result=await account({operation:'verify',email:'fixture@example.invalid',tokenHash:'a'.repeat(64)});
 assert.equal(result.status,403);assert.equal(result.data.code,'ACCOUNT_IDENTITY_MISMATCH');assert.equal(Object.hasOwn(result.data,'access_token'),false);
});
// In-memory Supabase transport fixture only. Production still uses the original SDK and database.
function databaseFixture(){
 const tables={notes:[{id:randomUUID(),owner_id:userA,title:'Owned fixture A',content:'original fixture A'},{id:randomUUID(),owner_id:userB,title:'Owned fixture B',content:'original fixture B'}],aleph_device_sessions:[],aleph_device_nonces:[],netbird_gateway_nonces:[]};
 return {tables,from(table){let op='read',values,filters=[],single=false,count=false;const query={
   select(_fields,options){count=options?.count==='exact';return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},gt(k,v){filters.push(r=>r[k]>v);return query;},order(){return query;},limit(){return query;},
   insert(v){op='insert';values=v;return query;},update(v){op='update';values=v;return query;},delete(){op='delete';return query;},maybeSingle(){single=true;return query;},single(){single=true;return query;},
   abortSignal(){return Promise.resolve(run());},then(resolve,reject){return Promise.resolve().then(run).then(resolve,reject);}};
   function run(){const rows=tables[table];if(!rows)throw Error('fixture table missing');let found=rows.filter(r=>filters.every(f=>f(r)));
    if(op==='insert'){
      if(table.endsWith('nonces')&&rows.some(r=>table==='netbird_gateway_nonces'?r.nonce===values.nonce:r.nonce===values.nonce&&r.device_id===values.device_id))return {data:null,error:{code:'23505'}};
      const row={...values};if(table==='aleph_device_sessions')row.approved??=false;rows.push(row);found=[row];
    }else if(op==='update')for(const row of found)Object.assign(row,values);
    else if(op==='delete')tables[table]=rows.filter(r=>!found.includes(r));
    return {data:count?null:single?found[0]??null:found,error:null,...(count?{count:found.length}:{})};
   }return query;
 }};
}
test('gateway proofs bind the original device proof, body and route; durable replay rejection stays separate',async()=>{
 const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}),db=databaseFixture();
 const req={method:'PUT',url:'/notes/'+randomUUID(),body:{title:'fixture',body:'body'},headers:{authorization:'Bearer fixture','x-aleph-device':randomUUID(),'x-aleph-nonce':randomUUID(),'x-aleph-at':String(Date.now()),'x-aleph-signature':'fixture-proof'}};
 const options={required:true,publicKey};assert.equal(verifyGatewayRequest(req,options),false);
 req.headers={...req.headers,...signGatewayRequest(pair.privateKey,req)};assert.equal(verifyGatewayRequest(req,options),true);
 assert.equal(verifyGatewayRequest({...req,body:{...req.body,body:'changed'}},options),false);
 assert.equal(verifyGatewayRequest({...req,headers:{...req.headers,'x-aleph-signature':'changed'}},options),false);
 assert.equal(await authorizeGateway(db,req,options),true);assert.equal(await authorizeGateway(db,req,options),false);
});

test('existing Vault handlers, Agent and signed Windows gateway share original notes and real denial/recovery effects',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'keshev-existing-vault-')),signer=createSigner(generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'})),gatewayKeys=generateKeyPairSync('ed25519');
 const publicKey=gatewayKeys.publicKey.export({type:'spki',format:'pem'}),database=databaseFixture(),tokens=new Map([[jwt(userA),userA],[jwt(userB),userB]]);
 const gate=request=>authorizeGateway(database,request,{required:true,publicKey});let xdrChecks=0;
 const services={database,authorizeGateway:gate,verifyLoginAuthorization:async authorization=>tokens.has(authorization?.slice(7))?{kind:'student',userId:tokens.get(authorization.slice(7))}:null,
   authorizeDevice:async(request,identity)=>await gate(request)&&await authorizeDevice(database,request,identity),xdr:{check:async()=>{xdrChecks++;return null;}}};
 let aiCalls=0;const quota=new Map();database.rpc=(name,args)=>({abortSignal:async()=>{assert.equal(name,'package_reserve_ai_call');const before=quota.get(args.p_user)??0,allowed=before<1,used=allowed?before+1:before;if(allowed)quota.set(args.p_user,used);return {data:{allowed,used,limit:1,remaining:Math.max(0,1-used),resetsAt:'2030-01-02T00:00:00Z'}};}});
 const ai=createAiHandler({getRuntime:()=>services,isProviderConfigured:()=>true,dailyLimit:1,ask:async()=>{aiCalls++;return 0.2;}}),intel=createThreatIntelHandler({getRuntime:()=>services,read:async component=>({component:{id:component},fixture:true})});
 const notes=createNotesHandler(()=>services),devices=createDeviceHandler(()=>services),auth=createAuthHandler(async(url,options)=>{
   if(url.pathname.endsWith('/user')){const id=tokens.get(options.headers.Authorization?.slice(7));return Response.json(id?{id}:{error:'bad'},{status:id?200:401});}
   if(url.pathname.endsWith('/token')){const input=JSON.parse(options.body),user=input.email==='fixture-b'?userB:userA;return Response.json({access_token:jwt(user),user:{id:user},expires_in:3600,refresh_token:'fixture-only',token_type:'bearer'});}
   return Response.json({});
 },{getGateway:()=>gate});
 const upstream=createServer(async(req,res)=>{
   const bytes=[];for await(const c of req)bytes.push(c);req.body=bytes.length?Buffer.concat(bytes).toString('utf8'):undefined;
   const url=new URL(req.url,'http://fixture.invalid');req.query=Object.fromEntries(url.searchParams);
   res.status=n=>{res.statusCode=n;return res;};res.json=value=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(value));};
   await (url.pathname==='/api/auth'?auth:url.pathname==='/api/device'?devices:url.pathname==='/api/ai'?ai:url.pathname==='/api/threat-intel'?intel:notes)(req,res);
 });upstream.listen(0,'127.0.0.1');await once(upstream,'listening');const upstreamOrigin=`http://127.0.0.1:${upstream.address().port}`;
 const store=createWorkspaceStore(join(directory,'windows.sqlite'),{deviceId:signer.deviceId});
 // The actual Windows VM is a few hundred milliseconds ahead of the Mac.
 // The observer timestamps its receipt read locally without changing source effect.
 const readCommand=store.readCommand;store.readCommand=(...args)=>({...readCommand(...args),observedAt:new Date(Date.now()+750).toISOString()});
 const vault=createVaultGateway({privateKey:gatewayKeys.privateKey,deviceId:signer.deviceId,store,origin:'https://fixture-vault.vercel.app',packageOrigin:'https://fixture-package.vercel.app',request:(url,options)=>{const path=new URL(url).pathname;assert.equal(new URL(url).origin,['/api/ai','/api/threat-intel'].includes(path)?'https://fixture-package.vercel.app':'https://fixture-vault.vercel.app');return fetch(upstreamOrigin+path+new URL(url).search,options);}});
 const resource=createResourceServer({client:'127.0.0.1',publicKey:signer.publicKey,store,vault});resource.listen(0,'127.0.0.1');await once(resource,'listening');const resourceOrigin=`http://127.0.0.1:${resource.address().port}`;
 const appDb=join(directory,'agent.sqlite');new DatabaseSync(appDb).close();
 const client={getSession:async()=>({status:'connected',sharing:true,profileId:'unrelated-chatgpt-fixture'}),listProfiles:async()=>[],cancelSignIn(){}};
 const app=await createWorkspaceServer(client,{signer,actionDatabasePath:appDb,target:'100.100.10.2',readNetwork:async()=>({daemonStatus:'Connected',management:{connected:true},peers:{details:[{netbirdIp:'100.100.10.2'}]}}),request:(url,options)=>fetch(resourceOrigin+new URL(url).pathname,options),directRequest:(url,options)=>fetch(upstreamOrigin+new URL(url).pathname+new URL(url).search,options)});
 app.listen(0,'127.0.0.1');await once(app,'listening');const origin=`http://127.0.0.1:${app.address().port}`,home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0];await home.body.cancel();
 const headers={cookie,'sec-fetch-site':'same-origin',origin,'content-type':'application/json'};
 const call=async(path,input,extra={})=>{const r=await fetch(origin+path,{headers:{...headers,...extra},...(input===undefined?{}:{method:'POST',body:JSON.stringify(input)})});return {status:r.status,body:await r.json()};};
 let authorization,device;
 async function browserHeaders(path,method='GET',body){const at=String(Date.now()),nonce=randomUUID(),h={authorization,'x-aleph-device':device.id,'x-aleph-at':at,'x-aleph-nonce':nonce};return {...h,'x-aleph-signature':sign('sha256',Buffer.from(requestMessage({id:device.id,at,nonce,method,path,bodyHash:sha(body===undefined?'':JSON.stringify(body)),tokenHash:sha(authorization)})),{key:device.key,dsaEncoding:'ieee-p1363'}).toString('base64url')};}
 try{
   assert.equal((await call('/api/me')).status,503);
   assert.equal((await call('/api/netbird/session')).status,401);
   const login=await call('/api/auth?path=token&grant_type=password',{email:'fixture-a',password:'fixture-only'});assert.equal(login.status,200);authorization='Bearer '+login.body.access_token;
   const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),jwk=pair.publicKey.export({format:'jwk'});
   const pending=await call('/api/device?operation=request',{publicKey:jwk},{authorization});assert.equal(pending.status,201,JSON.stringify(pending.body));
   device={id:pending.body.id,key:pair.privateKey};
   const signature=sign('sha256',Buffer.from(enrollmentMessage(device.id,pending.body.challenge,sha(authorization))),{key:device.key,dsaEncoding:'ieee-p1363'}).toString('base64url');
   assert.equal((await call('/api/device?operation=approve',{id:device.id,signature},{authorization})).body.approved,true);
   const numeric={level:0,failureCount:0,accountCount:0,multiAccount:false,samePassword:false};
   const model=await call('/api/package/ai',numeric);assert.equal(model.status,200,JSON.stringify(model.body));assert.equal(model.body.data.inferenceCompleted,true);
   assert.equal((await call('/api/package/ai',numeric)).status,429);assert.equal(aiCalls,1);
   assert.equal((await call('/api/package/intel?component=wazuh&page=0')).body.data.component.id,'wazuh');
   assert.equal((await call('/api/package/intel?component=wazuh&page=0&url=https://outside.invalid')).status,409);
   const path='/api/my/notes',first=await call(path,undefined,await browserHeaders(path));assert.equal(first.status,200,JSON.stringify(first.body));assert.deepEqual(first.body.map(n=>n.title),['Owned fixture A']);assert.ok(xdrChecks>0);
   const delegated=(await call('/api/netbird/session')).body;assert.equal(delegated.data.user.id,userA);assert.equal(Object.hasOwn(delegated.data,'refresh_token'),false);
   const comparison=(await call('/api/netbird/verify-direct',{headers:await browserHeaders(path)})).body.data;assert.equal(comparison.directStatus,403);assert.equal(comparison.privateStatus,200);assert.equal(comparison.sameBrowserProof,true);assert.equal(comparison.passed,true);
   const direct=await fetch(upstreamOrigin+path,{headers:await browserHeaders(path)});assert.equal(direct.status,403);
   const me=await call('/api/me');assert.equal(me.body.data.user.id,userA);assert.notEqual(me.body.data.user.id,'unrelated-chatgpt-fixture');
   const events=(await call('/api/events')).body.data,event=events.find(e=>e.supportedActions.includes('grant:remove'));
   const prepared=await call('/api/actions/prepare',{eventId:event.id,actionId:'grant:remove'});assert.equal(prepared.body.ok,true,JSON.stringify(prepared.body));
   await call('/api/actions/execute',{requestId:prepared.body.data.requestId,confirmationId:prepared.body.data.confirmationId});
   const effect=await call('/api/actions/result',{requestId:prepared.body.data.requestId});assert.equal(effect.body.ok,true,JSON.stringify(effect.body));assert.equal(effect.body.data.status,'succeeded');assert.equal(effect.body.data.observation.effectApplied,true);
   const blocked=await call(path,undefined,await browserHeaders(path));assert.equal(blocked.status,403);assert.equal(blocked.body.error,'GRANT_REMOVED');
   assert.equal((await fetch(upstreamOrigin+path,{headers:await browserHeaders(path)})).status,403);
   assert.equal((await call('/api/netbird/restore',{humanConfirmed:true})).body.ok,true);
   assert.equal((await call(path,undefined,await browserHeaders(path))).status,200);
   const after=await call('/api/actions/result',{requestId:prepared.body.data.requestId});assert.equal(after.body.data.status,'unknown');assert.equal(after.body.data.observation.effectApplied,false);
   assert.equal(database.tables.notes.length,2);assert.equal(database.tables.notes[1].content,'original fixture B');
 }finally{for(const server of [app,resource,upstream]){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(directory,{recursive:true,force:true});}
});
