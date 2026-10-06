import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import handler, { createNotesHandler } from '../api/notes.js';

const config={judgeIssuer:'https://judge.example.org/defense/judge',publicAppUrl:'https://vault-test.vercel.app',
  identityProvider:{issuer:'https://student-test.supabase.co/auth/v1',audience:'authenticated',jwksUrl:'https://student-test.supabase.co/auth/v1/.well-known/jwks.json'}};
const {privateKey,publicKey}=await generateKeyPair('ES256');
const a=randomUUID(), b=randomUUID();
const token=async(user=a,overrides={})=>new SignJWT({aleph_run:randomUUID(),aleph_role:'judge',aleph_identity:user===a?'a':'b',...overrides})
  .setProtectedHeader({alg:'ES256'}).setSubject(user).setIssuer(config.judgeIssuer)
  .setAudience(overrides.aud??'vault-test.vercel.app').setIssuedAt(overrides.iat??Math.floor(Date.now()/1000))
  .setExpirationTime(overrides.exp??Math.floor(Date.now()/1000)+300).sign(privateKey);
const verifier=createLoginVerifier({config,judgeKeySet:async()=>publicKey,supabaseClient:{auth:{getClaims:async()=>({error:{code:'invalid'}})}}});
const response=()=>({statusCode:null,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(v){this.body=v;return this;}});

// Exercise the unchanged cryptographic verifier, not a substitute decoder.
test('unchanged verifier rejects forged, expired and wrong-audience tokens',async()=>{
  assert.equal(await verifier(undefined),null);
  const valid=await token();
  assert.equal((await verifier('Bearer '+valid)).userId,a);
  const parts=valid.split('.'); parts[2]=(parts[2][0]==='a'?'b':'a')+parts[2].slice(1);
  assert.equal(await verifier('Bearer '+parts.join('.')),null);
  assert.equal(await verifier('Bearer '+await token(a,{iat:Math.floor(Date.now()/1000)-600,exp:Math.floor(Date.now()/1000)-300})),null);
  assert.equal(await verifier('Bearer '+await token(a,{aud:'other-service'})),null);
});

test('all unauthenticated methods fail before configuration or database access',async()=>{
  const never=createNotesHandler(()=>{throw new Error('must not run');});
  for(const method of ['GET','POST','PUT','DELETE']){const res=response();await never({method,query:{}},res);assert.equal(res.statusCode,401);assert.deepEqual(res.body,{error:'LOGIN_REQUIRED'});assert.equal(res.headers['Cache-Control'],'no-store');}
  const res=response();await handler({method:'GET',headers:{authorization:'Bearer invalid'}},res);
  assert.ok([401,503].includes(res.statusCode));assert.equal(Object.hasOwn(res.body,'notes'),false);
});

test('verified CRUD restricts rows to the verified owner and rejects ownership changes',async()=>{
  const records=new Map();
  const database=createClient('https://student-test.supabase.co','test-only-credential',{
    auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(target,options={})=>{
      const url=new URL(target),method=options.method??'GET', headers=new Headers(options.headers);
      assert.equal(headers.get('apikey'),'test-only-credential');
      const id=url.searchParams.get('id')?.slice(3);
      const owner=url.searchParams.get('owner_id')?.slice(3);
      const row=records.get(id);
      const visible=row && (!owner || row.owner_id===owner);
      let data;
      if(method==='POST'){const row=JSON.parse(options.body);if(records.has(row.id))return new Response(JSON.stringify({code:'23505'}),{status:409});records.set(row.id,row);data=row;}
      else if(method==='PATCH'){if(visible)Object.assign(row,JSON.parse(options.body));data=visible?row:null;}
      else if(method==='DELETE'){data=visible?row:null;if(visible)records.delete(id);}
      else if(id)data=visible?row:null;
      else {const owner=url.searchParams.get('owner_id')?.slice(3);data=[...records.values()].filter(row=>row.owner_id===owner);}
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
    }}});
  const run=createNotesHandler(()=>({database,verifyLoginAuthorization:verifier}));
  const call=async(method,user,id,body)=>{const res=response();await run({method,headers:{authorization:'Bearer '+await token(user)},query:id?{id}:{},body},res);return res;};
  const posted=await call('POST',a,null,{title:'fixture',body:'fixture body'});
  assert.equal(posted.statusCode,201);const id=posted.body.id;assert.equal(records.get(id).owner_id,a);
  assert.equal((await call('GET',a)).body.length,1);assert.equal((await call('GET',b)).body.length,0);
  const own=await call('GET',a,id);assert.equal(own.statusCode,200);assert.deepEqual(Object.keys(own.body).sort(),['body','id','title']);
  assert.equal((await call('GET',b,id)).statusCode,404);
  assert.equal((await call('PUT',b,id,{title:'other edit',body:'other body'})).statusCode,404);
  assert.equal((await call('DELETE',b,id)).statusCode,404);
  assert.equal(records.get(id).title,'fixture');
  assert.equal((await call('PUT',a,id,{title:'fixture edited',body:'fixture edited body',owner_id:b})).statusCode,400);
  assert.equal((await call('POST',a,null,{title:'fixture',body:'fixture body',owner_id:b})).statusCode,400);
  const ownUpdate=await call('PUT',a,id,{title:'fixture edited',body:'fixture edited body'});assert.equal(ownUpdate.statusCode,200);
  assert.equal(records.get(id).owner_id,a);
  assert.equal((await call('DELETE',a,id)).statusCode,200);
  assert.equal((await call('GET',a,id)).statusCode,404);
  assert.equal((await call('POST',a,null,{title:'',body:''})).statusCode,400);
});
