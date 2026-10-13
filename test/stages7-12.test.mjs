import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, createDecider, PRACTICE_RESOURCE_GRANTS } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

test('step-up uses a trusted compound signal, keeps device denial, and checks freshness', async () => {
  const { normal, suspicious } = fixtureRequests();
  assert.equal((await decide(normal)).decision, 'allow');
  assert.equal((await decide(suspicious)).decision, 'step_up');
  assert.equal((await decide({ ...normal, signals: { ...normal.signals, region: 'foreign' } })).decision, 'allow');
  assert.equal((await decide({ ...suspicious, deviceRegistered: false })).reasonCode, 'device_not_registered');
  for (const age of [0, 60, 900]) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'allow');
  for (const age of [-1, 901, null, '60']) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'step_up');
  for (const signals of [{ ...normal.signals, hour: undefined }]) {
    assert.equal((await decide({ ...normal, signals })).decision, 'step_up');
  }
  assert.equal((await decide({ ...normal, recentEvents: {} })).decision, 'step_up');
  const live = createDecider([{...PRACTICE_RESOURCE_GRANTS[0],source:'none'}]);
  assert.equal((await live({ ...normal, signals: { source: 'none', region: 'unknown', network: 'unknown', hour: 12 } })).decision, 'allow');
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


test('resource grants bind the same path to a subject, device, tenant, action and verified source', async () => {
  const {normal,suspicious}=fixtureRequests();
  assert.equal((await decide(normal)).decision,'allow');
  for(const fields of [{subjectId:'synthetic-other-principal'}, {deviceId:'bbbbbbbbbbbbbbbb'},
    {classId:'other-class'}, {projectId:'other-project'}, {policyRevision:2}, {role:'teacher'}, {resourceGrants:PRACTICE_RESOURCE_GRANTS},
    {signals:{...normal.signals,source:'none'}}, {signals:undefined}, {querySha256:'0'.repeat(64)}]) {
    assert.equal((await decide({...normal,...fields})).decision,'deny');
  }
  assert.equal((await createDecider([])(normal)).decision,'deny');
  const grant={...PRACTICE_RESOURCE_GRANTS[0],source:'none',subjectId:'server-managed-opaque-user',deviceId:'bbbbbbbbbbbbbbbb',path:'/notes/00000000-0000-4000-8000-000000000001'};
  const scoped=createDecider([grant]);
  const own={...normal,subjectId:grant.subjectId,deviceId:grant.deviceId,path:grant.path,signals:{source:'none',region:'unknown',network:'unknown',hour:14}};
  assert.equal((await scoped(own)).decision,'allow');
  assert.equal((await scoped({...own,subjectId:'other-opaque-user'})).decision,'deny');
  // A caller cannot mutate a previously installed grant or submit a replacement grant.
  grant.subjectId='other-opaque-user';grant.methods=['DELETE'];
  assert.equal((await scoped(own)).decision,'allow');
  assert.equal((await scoped({...own,subjectId:grant.subjectId})).decision,'deny');
  assert.equal((await decide(suspicious)).decision,'step_up');
  assert.equal((await decide({...suspicious,stepUp:{verified:true,authAgeSeconds:60}})).decision,'allow');
  const edit=createDecider([{...PRACTICE_RESOURCE_GRANTS[0],service:'announcements',path:'/announcements/demo',methods:['PUT']}]);
  const announcement={...normal,service:'announcements',method:'PUT',path:'/announcements/demo',route:'PUT /announcements/:id'};
  assert.equal((await edit(announcement)).decision,'allow');
  assert.equal((await edit({...announcement,subjectId:'ungranted-student'})).decision,'deny');
});


test('resource policy runs with no Node or browser helpers in an empty module context', async () => {
  const {readFile}=await import('node:fs/promises');
  const {SourceTextModule,createContext}=await import('node:vm');
  const module=new SourceTextModule(await readFile(new URL('../src/decider.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('external imports are not permitted');});
  await module.evaluate({timeout:1000});
  const {normal,suspicious}=fixtureRequests();
  for(const [input,expected] of [[normal,'allow'],[{...normal,subjectId:'other-principal'},'deny'],[suspicious,'step_up']]) {
    const actual=await module.namespace.decide(input);
    assert.equal(actual.decision,expected);
    assert.deepEqual(Object.keys(actual).sort(),['decision','reasonCode','requestId','ruleIds','schema']);
    assert.equal(actual.requestId,input.requestId);
  }
});

test('the existing operator XDR entry uses server-installed resource grants', async () => {
  const {connectXdrDecider}=await import('../src/xdr-decider.mjs');
  const {normal}=fixtureRequests();
  const {decide:connected}=connectXdrDecider({resourceGrants:[PRACTICE_RESOURCE_GRANTS[0]],
    getTrustedSource:async()=> '192.0.2.120', getRules:async()=>[],
    denyReasonCode:'xdr_brute_force',allowedReasonCodes:['xdr_brute_force']});
  assert.equal((await connected(normal)).decision,'allow');
  assert.equal((await connected({...normal,subjectId:'other-principal'})).decision,'deny');
});
