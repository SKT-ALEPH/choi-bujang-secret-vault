import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {authorizeDevice,fingerprint,verifyDeviceSignature,publicDeviceKey} from '../src/device-session.mjs';
import {requestMessage,canonicalTarget} from '../public/device-message.mjs';
import {createNotesHandler} from '../api/notes.js';

test('non-extractable browser key signs method/path/body/token; missing, changed, stale and replayed proof is denied',async()=>{
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 await assert.rejects(webcrypto.subtle.exportKey('jwk',keys.privateKey));
 const jwk=publicDeviceKey(await webcrypto.subtle.exportKey('jwk',keys.publicKey));
 assert.throws(()=>publicDeviceKey({...jwk,d:'private'}));
 const id='00000000-0000-4000-8000-000000000001',nonce='00000000-0000-4000-8000-000000000002',at=String(Date.now());
 const identity={kind:'student',userId:'verified-user'},authorization='Bearer synthetic-token',body={title:'Synthetic',body:'Synthetic content'};
 const record={public_jwk:jwk,token_hash:fingerprint(authorization),approved:true,expires_at:new Date(Date.now()+60000).toISOString()};
 const seen=new Set();
 const database={from(table){
   if(table==='aleph_device_nonces')return{insert(row){const exists=seen.has(row.nonce);seen.add(row.nonce);
     return{async abortSignal(){return{error:exists?{code:'23505'}:null};}};}};
   return{select(){return this;},eq(){return this;},maybeSingle(){return this;},async abortSignal(){return{data:record,error:null};}};
 }};
 const message=requestMessage({id,at,nonce,method:'PUT',path:'/api/notes/example',bodyHash:fingerprint(JSON.stringify(body)),tokenHash:fingerprint(authorization)});
 const signature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(message))).toString('base64url');
 assert.equal(verifyDeviceSignature(jwk,message,signature),true);
 const req={url:'/api/notes/example',method:'PUT',body,headers:{authorization,'x-aleph-device':id,'x-aleph-at':at,'x-aleph-nonce':nonce,'x-aleph-signature':signature}};
 assert.equal(await authorizeDevice(database,{...req,headers:{authorization}},identity),false);
 assert.equal(await authorizeDevice(database,{...req,url:'/api/notes/other'},identity),false);
 assert.equal(await authorizeDevice(database,{...req,body:{...body,body:'Changed'}},identity),false);
 assert.equal(await authorizeDevice(database,{...req,method:'DELETE'},identity),false);
 assert.equal(await authorizeDevice(database,{...req,headers:{...req.headers,authorization:'Bearer other'}},identity),false);
 assert.equal(await authorizeDevice(database,{...req,headers:{...req.headers,'x-aleph-at':String(Date.now()-31000)}},identity),false);
 record.approved=false;assert.equal(await authorizeDevice(database,req,identity),false);record.approved=true;
 assert.equal(await authorizeDevice(database,req,identity),true);
 assert.equal(await authorizeDevice(database,req,identity),false);
 const getNonce='00000000-0000-4000-8000-000000000003';
 const getMessage=requestMessage({id,at,nonce:getNonce,method:'GET',path:'/api/my/notes',bodyHash:fingerprint(''),tokenHash:fingerprint(authorization)});
 const getSignature=Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(getMessage))).toString('base64url');
 assert.equal(await authorizeDevice(database,{url:'/api/my/notes',method:'GET',body:{},headers:{...req.headers,'x-aleph-nonce':getNonce,'x-aleph-signature':getSignature}},identity),true);
});

test('shared data handler refuses an authenticated but unapproved device before reading any note',async()=>{
 let databaseUsed=false;
 const handler=createNotesHandler(()=>({verifyLoginAuthorization:async()=>({kind:'student',userId:'synthetic'}),authorizeDevice:async()=>false,database:{from(){databaseUsed=true;throw Error('must not read')}}}));
 const res={setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;}};
 await handler({method:'GET',headers:{authorization:'valid'},query:{}},res);
 assert.equal(res.statusCode,403);assert.equal(res.body.error,'DEVICE_NOT_APPROVED');assert.equal(databaseUsed,false);
});

test('PWA caches only public offline instructions and disables persistent SDK sessions',async()=>{
 const [app,sw,html,manifest]=await Promise.all(['app.js','sw.js','index.html','manifest.webmanifest'].map(f=>readFile(new URL('../public/'+f,import.meta.url),'utf8')));
 assert.match(app,/persistSession:false/);assert.doesNotMatch(app,/(?:localStorage|sessionStorage)\.setItem|indexedDB/u);
 assert.match(html,/id="device-panel"[^>]*hidden/u);assert.match(html,/rel="manifest"/u);
 assert.equal(JSON.parse(manifest).display,'standalone');assert.match(sw,/cache\.add\('\/offline.html'\)/u);assert.doesNotMatch(sw,/cache\.put|cache\.addAll/u);
});

test('signed target matches every existing Vercel rewrite and keeps different resources and query values distinct',async()=>{
 const deployment=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 for(const route of deployment.rewrites){
  const source=route.source.replace(/:id|:noteId/gu,'00000000-0000-4000-8000-000000000001');
  const destination=route.destination.replace(/:id|:noteId/gu,'00000000-0000-4000-8000-000000000001');
  assert.equal(canonicalTarget(source),canonicalTarget(destination));
 }
 assert.notEqual(canonicalTarget('/notes/a'),canonicalTarget('/notes/b'));
 assert.notEqual(canonicalTarget('/notes/a'),canonicalTarget('/announcements/a'));
 assert.notEqual(canonicalTarget('/notes/a?action=all'),canonicalTarget('/notes/a'));
});
