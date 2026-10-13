import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

test('step-up uses a trusted compound signal, keeps device denial, and checks freshness', async () => {
  const { normal, suspicious } = fixtureRequests();
  assert.equal((await decide(normal)).decision, 'allow');
  assert.equal((await decide(suspicious)).decision, 'step_up');
  assert.equal((await decide({ ...normal, signals: { ...normal.signals, region: 'foreign' } })).decision, 'allow');
  assert.equal((await decide({ ...suspicious, deviceRegistered: false })).reasonCode, 'device_not_registered');
  for (const age of [0, 60, 900]) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'allow');
  for (const age of [-1, 901, null, '60']) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'step_up');
  for (const signals of [undefined, { ...normal.signals, source: 'client_header' }, { ...normal.signals, hour: undefined }]) {
    assert.equal((await decide({ ...normal, signals })).decision, 'step_up');
  }
  assert.equal((await decide({ ...normal, recentEvents: {} })).decision, 'step_up');
  assert.equal((await decide({ ...normal, signals: { source: 'none', region: 'unknown', network: 'unknown', hour: 12 } })).decision, 'allow');
  assert.equal((await decide({ ...suspicious, recentEvents: [{ kind: 'risk_signal', count: 20, ageSeconds: 601 }] })).decision, 'allow');
});

 test('resource scope checks exact method/path/route and the API rejects authority selectors before DB access', async () => {
  const { normal } = fixtureRequests();
  assert.equal((await decide({ ...normal, method: 'PUT', route: 'PUT /notes/:id' })).decision, 'allow');
  for (const fields of [{subjectId:undefined}, {subjectId:''}, {queryLength:1},
    {path:'/notes/00000000-0000-4000-8000-000000000001'},
    {path:'/notes'}, {path:'/notes/all'}, {path:'/notes/other'}, {path:'/notes/export'}, {path:'/notes/demo/export'}, {service:'announcements'},
    {method:'PUT',path:'/announcements/demo',route:'PUT /announcements/:id'}, {path:'/other/demo'}]) {
    assert.equal((await decide({ ...normal, ...fields })).decision, 'deny');
  }
  const { createNotesHandler } = await import('../api/notes.js');
  const handler=createNotesHandler(()=>({verifyLoginAuthorization:async()=>({userId:'fixture-user'}),database:{from(){throw Error('must not reach database');}}}));
  for(const [method,query,body,error] of [
    ['GET',{action:'export'},undefined,'RESOURCE_QUERY_NOT_ALLOWED'],
    ['PUT',{id:'00000000-0000-4000-8000-000000000001'},{title:'fixture',body:'fixture',role:'teacher'},'RESOURCE_AUTHORITY_IMMUTABLE'],
  ]) {
    let status,result;const response={setHeader(){},status(n){status=n;return this;},json(v){result=v;}};
    await handler({method,headers:{authorization:'fixture-header'},query,body},response);
    assert.equal(status,400);assert.equal(result.error,error);
  }
 });

test('announcements use verified identity and a stored per-resource grant, never a body role', async () => {
  const { createAnnouncementsHandler } = await import('../api/announcements.js');
  const id = '00000000-0000-4000-8000-000000000001';
  let identity = {kind:'student',userId:'virtual-student'}, calls=0;
  const handler = createAnnouncementsHandler(() => ({
    verifyLoginAuthorization:async()=>identity,
    database:{rpc(name,args){
      calls++; assert.equal(name,'edit_announcement'); assert.equal(args.p_user,identity.userId);
      assert.equal(args.p_id,id); assert.deepEqual(Object.keys(args).sort(),['p_content','p_id','p_title','p_user']);
      return {abortSignal:async()=>({data:identity.userId==='virtual-instructor'?[{id,title:'fixture',content:'fixture'}]:[],error:null})};
    }}
  }));
  const call=async(body,headers={authorization:'test-header'},query={id})=>{
    const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;}};
    await handler({method:'PUT',headers,query,body},response);return response;
  };
  assert.equal((await call({title:'fixture',body:'fixture'},{})).statusCode,401);
  assert.equal((await call({title:'fixture',body:'fixture',role:'teacher'})).statusCode,400);
  assert.equal(calls,0);
  assert.equal((await call({title:'fixture',body:'fixture'})).statusCode,403);
  identity={kind:'judge',userId:'virtual-student'};
  assert.equal((await call({title:'fixture',body:'fixture'})).statusCode,403);
  identity={kind:'student',userId:'virtual-instructor'};
  const allowed=await call({title:'fixture',body:'fixture'});
  assert.equal(allowed.statusCode,200);assert.equal(allowed.headers['X-Resource-ID'],'announcements/'+id);
  assert.equal((await call({title:'fixture',body:'fixture'},undefined,{id,action:'export'})).statusCode,400);
  identity=null;assert.equal((await call({title:'fixture',body:'fixture'})).statusCode,401);
});
