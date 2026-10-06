import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createAuthHandler } from '../api/auth.js';
import settings from '../config/supabase-public.json' with { type: 'json' };

const response = () => ({ headers:{},statusCode:null,body:null,
  setHeader(k,v){this.headers[k]=v;},status(c){this.statusCode=c;return this;},json(v){this.body=v;return this;} });

test('Auth proxy permits only fixed Auth routes, keeps public key upstream, and suppresses diagnostics', async () => {
  let calls=0;
  const handler=createAuthHandler(async(target, options)=>{
    calls++; const url=new URL(target);
    assert.equal(url.origin,settings.url); assert.equal(url.pathname,'/auth/v1/token');
    assert.equal(options.headers.apikey,settings.publishableKey);
    assert.equal(options.headers.Authorization,undefined); assert.equal(options.redirect,'error');
    return new Response(JSON.stringify({code:'invalid_credentials',msg:'private diagnostic'}),{status:400});
  });
  const bad=response(); await handler({method:'GET',query:{path:'rest/v1/notes'}},bad);
  assert.equal(bad.statusCode,404); assert.equal(calls,0);
  const grant=response(); await handler({method:'POST',query:{path:'token',grant_type:'other'}},grant);
  assert.equal(grant.statusCode,400); assert.equal(calls,0);
  const missing=response(); await handler({method:'GET',query:{path:'user'}},missing);
  assert.equal(missing.statusCode,401); assert.equal(calls,0);
  const result=response(); await handler({method:'POST',query:{path:'token',grant_type:'password'},
    headers:{authorization:'Bearer auth-via-server'},body:{}},result);
  assert.equal(result.statusCode,400); assert.equal(result.headers['Cache-Control'],'no-store');
  assert.equal(result.body.code,'invalid_credentials'); assert.equal(JSON.stringify(result.body).includes('private diagnostic'),false);
  assert.equal(JSON.stringify(result.body).includes(settings.publishableKey),false);
});

test('official SDK signs in, refreshes and signs out through the Auth proxy without a browser key', async () => {
  const seen=[];
  const handler=createAuthHandler(async(target,options)=>{
    const url=new URL(target);seen.push(url.pathname);
    assert.equal(options.headers.apikey,settings.publishableKey);
    if(url.pathname==='/auth/v1/logout') {assert.equal(options.headers.Authorization,'Bearer fixture-session');return new Response(null,{status:204});}
    if(url.pathname==='/auth/v1/user') return Response.json({id:'fixture-user'});
    assert.equal(url.pathname,'/auth/v1/token');
    assert.ok(['password','refresh_token'].includes(url.searchParams.get('grant_type')));
    return Response.json({access_token:'fixture-session',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:{id:'fixture-user'}});
  });
  const client=createClient(settings.url,'auth-via-server',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(target,options)=>{
    const url=new URL(target);assert.equal(url.origin,settings.url);
    assert.ok(url.pathname.startsWith('/auth/v1/'));const result=response();
    await handler({method:options.method,query:{path:url.pathname.slice('/auth/v1/'.length),...Object.fromEntries(url.searchParams)},
      headers:Object.fromEntries(new Headers(options.headers)),body:options.body},result);
    return Response.json(result.body,{status:result.statusCode});
  }}});
  // Deliberately invalid fixture credentials go only to the injected transport.
  const login=await client.auth.signInWithPassword({email:'fixture',password:'fixture'});assert.equal(login.error,null);
  assert.equal((await client.auth.refreshSession()).error,null);
  assert.equal((await client.auth.signOut()).error,null);
  assert.equal((await client.auth.getSession()).data.session,null);
  assert.deepEqual(seen,['/auth/v1/token','/auth/v1/token','/auth/v1/logout']);
});
