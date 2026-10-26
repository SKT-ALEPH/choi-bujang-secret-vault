import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createSigner,sha} from '../personal-workspace/wire.mjs';
import {createWorkspaceStore} from '../personal-workspace/store.mjs';
import {createResourceServer} from '../personal-workspace/resource.mjs';
import {createWorkspaceServer} from '../personal-workspace/server.mjs';

function key(){const k=generateKeyPairSync('ed25519');return createSigner(k.privateKey.export({type:'pkcs8',format:'pem'}));}
const actor=signer=>({owner:'owner-'+sha('fixture-only-account'),device:signer.deviceId,session:randomUUID()});
test('real SQLite enforces ownership, optimistic edits, archive challenge, XDR evidence and idempotent observed actions',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'keshev-store-')),signer=key(),path=join(directory,'app.sqlite');let store=createWorkspaceStore(path,{deviceId:signer.deviceId});
 const a=actor(signer),b={...actor(signer),owner:'owner-'+sha('another-fixture-only-account')};const call=(path,input={},who=a)=>store.route(path,{actor:who,input});
 try{
  assert.equal(call('/agent/session').decision,'allow');call('/agent/session',{},b);
  const id=call('/agent/note/save',{id:null,title:'Temporary test note',body:'test-only-body-not-in-events',revision:0}).id;
  assert.equal(call('/agent/notes',{view:'active'}).notes.length,1);assert.equal(call('/agent/notes',{view:'active'},b).notes.length,0);
  assert.throws(()=>call('/agent/note/save',{id,title:'not mine',body:'no',revision:1},b),/NOTE_NOT_FOUND/);
  call('/agent/note/save',{id,title:'Updated test',body:'test-only-body-not-in-events',revision:1});
  assert.throws(()=>call('/agent/note/save',{id,title:'stale',body:'no',revision:1}),/NOTE_CHANGED/);
  call('/agent/note/archive',{id,revision:2,deleted:1});
  assert.equal(call('/agent/access',{appId:'private-archive'}).decision,'challenge');assert.throws(()=>call('/agent/notes',{view:'archive'}),/ARCHIVE_CONFIRMATION_REQUIRED/);
  call('/agent/stepup',{humanConfirmed:true});assert.equal(call('/agent/access',{appId:'private-archive'}).decision,'allow');assert.ok(call('/agent/events').events.some(e=>e.appId==='private-archive'&&e.state.access==='allowed'));assert.equal(call('/agent/notes',{view:'archive'}).notes[0].id,id);
  call('/agent/note/archive',{id,revision:3,deleted:0});
  call('/agent/access',{appId:'private-workspace'});const e=call('/agent/events').events.find(e=>e.supportedActions.includes('grant:remove'));
  assert.ok(!JSON.stringify(call('/agent/events')).includes('test-only-body-not-in-events'));
  const p=call('/agent/action/prepare',{eventId:e.id,actionId:'grant:remove'});
  assert.throws(()=>call('/agent/action/execute',{requestId:p.requestId,confirmationId:p.confirmationId,humanConfirmed:false}),/CONFIRMATION_REQUIRED/);
  const applied=call('/agent/action/execute',{requestId:p.requestId,confirmationId:p.confirmationId,humanConfirmed:true});assert.equal(applied.status,'succeeded');assert.equal(applied.currentlyApplied,true);
  assert.equal(call('/agent/action/execute',{requestId:p.requestId,confirmationId:p.confirmationId,humanConfirmed:true}).replayed,true);
  for(let i=0;i<5;i++)assert.throws(()=>call('/agent/notes',{view:'active'}),/GRANT_REMOVED/);
  const alerts=call('/agent/events').events.filter(e=>e.kind==='xdr');assert.equal(alerts.length,1);assert.match(alerts[0].rules[0].id,/REPEATED_AUTHORIZATION_DENIALS/);
  store.close();store=createWorkspaceStore(path,{deviceId:signer.deviceId});assert.equal(call('/agent/action/result',{requestId:p.requestId}).status,'succeeded');
  call('/agent/restore',{humanConfirmed:true});assert.equal(call('/agent/action/result',{requestId:p.requestId}).status,'superseded');assert.equal(call('/agent/receipts').receipts.find(r=>r.requestId===p.requestId).currentlyApplied,false);assert.equal(call('/agent/receipts',{},b).receipts.length,0);assert.throws(()=>call('/agent/action/prepare',{eventId:e.id,actionId:'device:revoke'}),/CONFIRMATION_EXPIRED_OR_CHANGED/);assert.equal(call('/agent/notes',{view:'active'}).notes.length,1);
  const access=call('/agent/access',{appId:'private-workspace'});assert.equal(access.decision,'allow');const latest=call('/agent/events').events.find(e=>e.supportedActions.includes('device:revoke'));
  const revoke=call('/agent/action/prepare',{eventId:latest.id,actionId:'device:revoke'});call('/agent/action/execute',{requestId:revoke.requestId,confirmationId:revoke.confirmationId,humanConfirmed:true});assert.throws(()=>call('/agent/notes',{view:'active'}),/DEVICE_REVOKED/);
  assert.equal(call('/agent/action/result',{requestId:revoke.requestId}).currentlyApplied,true);call('/agent/restore',{humanConfirmed:true});assert.equal(call('/agent/status').decision,'allow');
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('private HTTP rejects unsigned, changed and replayed messages; startup key binds its registered device',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'keshev-wire-')),signer=key(),store=createWorkspaceStore(join(directory,'db.sqlite'),{deviceId:signer.deviceId}),server=createResourceServer({client:'127.0.0.1',publicKey:signer.publicKey,store});server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`,path='/agent/session',data={actor:actor(signer),input:{}},bytes=Buffer.from(JSON.stringify(data)),headers={'content-type':'application/json',...signer.headers(path,bytes)};
 try{
  assert.equal((await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json'},body:bytes})).status,403);
  assert.equal((await fetch(origin+path,{method:'POST',headers,body:bytes})).status,200);
  const replay=await fetch(origin+path,{method:'POST',headers,body:bytes});assert.equal(replay.status,403);assert.equal((await replay.json()).error.code,'REPLAY_REJECTED');
  const bad=await fetch(origin+path,{method:'POST',headers:{'content-type':'application/json',...signer.headers(path,bytes)},body:JSON.stringify({...data,input:{spoof:true}})});assert.equal(bad.status,403);
  assert.equal((await fetch(origin+'/keshev-health')).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
test('existing Agent replaces the parallel workspace UI; ChatGPT login alone grants no vault identity',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'keshev-agent-')),signer=key();
 const {DatabaseSync}=await import('node:sqlite');const databasePath=join(directory,'agent.sqlite');new DatabaseSync(databasePath).close();let calls=0;
 const client={getSession:async()=>({status:'connected',sharing:true,profileId:'test-only-profile'}),listProfiles:async()=>[],cancelSignIn(){},listModels:async()=>[{slug:'fixture-model',displayName:'Fixture'}],streamResponse:async()=>{calls++;return {text:'fixture'};}};
 let pcReads=0;
 const server=await createWorkspaceServer(client,{signer,actionDatabasePath:databasePath,readPcSecurity:async()=>{pcReads++;return {schema:'keshev.pc-security.v1',status:'measured',endpoints:[],events:[]};},readNetwork:async()=>({daemonStatus:'Disconnected',management:{connected:false},peers:{details:[]}})});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const home=await fetch(origin),html=await home.text(),cookie=home.headers.get('set-cookie').split(';')[0];
  assert.match(html,/id="view-apps"/);assert.doesNotMatch(html,/id="note-form"/);assert.equal(home.headers.get('x-keshev-application'),'netbird-integrated');
  assert.equal((await fetch(origin+'/api/me')).status,403);
  assert.equal((await fetch(origin+'/api/me',{headers:{cookie,'sec-fetch-site':'cross-site'}})).status,403);
  const me=await fetch(origin+'/api/me',{headers:{cookie,'sec-fetch-site':'same-origin'}});assert.equal(me.status,503);assert.equal((await me.json()).ok,false);
  assert.equal((await fetch(origin+'/workspace/api/notes',{headers:{cookie,'sec-fetch-site':'same-origin'}})).status,403);
  assert.equal((await fetch(origin+'/api/pc-security')).status,403);
  assert.equal((await fetch(origin+'/api/pc-security',{headers:{cookie,'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal(pcReads,0);
  const pc=await fetch(origin+'/api/pc-security',{headers:{cookie,'sec-fetch-site':'same-origin'}});assert.equal(pc.status,200);assert.equal((await pc.json()).data.schema,'keshev.pc-security.v1');assert.equal(pcReads,1);
  assert.equal(calls,0);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
});
