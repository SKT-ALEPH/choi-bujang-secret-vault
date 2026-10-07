import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, createContext } from 'node:vm';
import { createDecider } from '../xdr/web-injection/analyze.mjs';
import { readAlerts, normalizeAlert } from '../xdr/web-injection/read-alerts.mjs';
import { inputSignals, patternName } from '../xdr/web-injection/signals.mjs';
import { createJevClient } from '../xdr/web-injection/jev.mjs';
import { respond } from '../xdr/web-injection/respond.mjs';
import { createXdrGuard } from '../xdr/brute-force/guard.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { createLiveWebXdr } from '../xdr/web-injection/live.mjs';
import { createAuthHandler } from '../api/auth.js';
const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/web-injection.json', import.meta.url)));

test('26 original/extracted events produce 8/9/9 in an empty VM with changed IDs and order', async () => {
  const extracted = await readAlerts(); assert.equal(extracted.length, fixture.alerts.length);
  const module = new SourceTextModule(await readFile(new URL('../xdr/web-injection/decide.mjs', import.meta.url), 'utf8'), { context: createContext({}) });
  await module.link(() => { throw Error('IMPORT_FORBIDDEN'); }); await module.evaluate();
  const raw = module.namespace.createDecider(), flat = module.namespace.createDecider(), original = createDecider();
  const counts = {block:0,alert:0,record:0};
  for (const [index, alert] of [...fixture.alerts].reverse().entries()) {
    const expected = await original(alert);
    assert.deepEqual(JSON.parse(JSON.stringify(await raw({...alert,id:`renamed-${index}`}))), expected);
    assert.deepEqual(JSON.parse(JSON.stringify(await flat(normalizeAlert(alert)))), expected);
    assert.deepEqual(Object.keys(normalizeAlert(alert)).sort(), ['account','description','level','sourceAddress','timestamp']);
    counts[expected.action]++;
  }
  assert.deepEqual(counts,{block:8,alert:9,record:9});
  const privateRow=normalizeAlert({...fixture.alerts[0],rule:{level:6,description:'password="do-not-store" Bearer do-not-send person@example.invalid'},data:{srcip:'192.0.2.9',srcuser:'person@example.invalid'}});
  assert.doesNotMatch(JSON.stringify(privateRow),/do-not|person@/u);
});

test('clear syntax, safe words, percent encoding and bounded same-source repeated events', async () => {
  for (const value of ['select course','script class','up notes',"O'Connor",'file;name']) assert.equal(patternName(inputSignals(value)),null);
  for (const value of ["' OR 1=1 --",'<script>alert(1)</script>','../../etc/hosts',';whoami','%253Cscript%253E']) assert.ok(patternName(inputSignals(value)));
  const decide=createDecider(); const at=Date.parse('2026-10-07T00:00:00Z');
  const row=index=>({id:`probe-${index}`,timestamp:new Date(at+index*1000).toISOString(),sourceAddress:'192.0.2.8',level:6,description:'SQL 구문 주입 1건'});
  assert.equal((await decide(row(0))).action,'alert');
  for(let repeat=0;repeat<10;repeat++) assert.equal((await decide(row(0))).action,'alert');
  for(let index=1;index<7;index++) assert.equal((await decide(row(index))).action,'alert');
  assert.equal((await decide(row(7))).action,'block');
  assert.equal((await decide(row(200))).action,'alert');
});

test('Jev thresholds, no single-event block, failures and provider privacy', async () => {
  const ambiguous=fixture.alerts[16];
  for(const [score,action] of [[0.1,'record'],[.5,'alert'],[.85,'alert'],[1,'alert'],[null,'alert'],[NaN,'alert']]) assert.equal((await createDecider({askJev:async()=>score})(ambiguous)).action,action);
  assert.equal((await createDecider({askJev:async()=>{throw Error('error');}})(ambiguous)).action,'alert');
  assert.equal((await createDecider({timeoutMs:5,askJev:()=>new Promise(()=>{})})(ambiguous)).action,'alert');
  let transmitted;
  const client=createJevClient({enabled:true,getApiKey:()=> 'test-only',fetchImpl:async(_url,options)=>{transmitted=JSON.parse(options.body);return {ok:true,json:async()=>({answers:{is_web_injection:{type:'noul',noul:.6}}})};}});
  assert.equal(await client({level:6,repeatCount:1,sql:true,description:'private memo',source:'private address',password:'private password'}),.6);
  assert.deepEqual(Object.keys(transmitted.state).sort(),['command','level','repeatCount','script','sql','traversal']);
  assert.doesNotMatch(JSON.stringify(transmitted),/private memo|private address|private password/u);
});

test('responder persistence, normal replay, expiry and original deny/step-up preservation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'xdr02-'));
  try {
    await mkdir(join(root,'xdr/web-injection'),{recursive:true});
    const decide=createDecider(),decisions=[];
    for(const alert of fixture.alerts)decisions.push({alertId:alert.id,...await decide(alert)});
    await respond({root,result:{decisions},alerts:fixture.alerts});
    await respond({root,result:{decisions},alerts:fixture.alerts});
    const rules=await readDenyRules(join(root,'xdr/web-injection/deny-rules.json'));assert.equal(rules.length,8);
    const proof=JSON.parse(await readFile(join(root,'xdr/web-injection/verification.json')));assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.blockedCandidates,8);
    assert.equal((await readFile(join(root,'xdr/alerts.log'),'utf8')).trim().split('\n').length,9);
    const binding={getTrustedSource:async()=>rules[0].sourceAddress,getRules:async()=>[rules[0]],denyReasonCode:'xdr_web_injection',allowedReasonCodes:['xdr_web_injection'],now:()=>rules[0].expiresAt};
    assert.equal((await createXdrGuard(async()=>({decision:'allow'}),binding)({requestId:'test'})).decision,'allow');
    for(const decision of ['deny','step_up']) assert.equal((await createXdrGuard(async()=>({decision}),binding)({requestId:'test'})).decision,decision);
  }finally{await rm(root,{recursive:true,force:true});}
});

function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;}};}
function databaseMock(){
  let count=0,stored=null;const calls=[];
  return {calls,from(){return{select(){return this;},eq(){return this;},maybeSingle(){return this;},async abortSignal(){return{data:stored,error:null};}};},rpc(name,input){calls.push({name,input});return{async abortSignal(){if(name==='xdr_web_observe')return{data:{at:'2026-10-07T00:00:00Z',windowStarted:'2026-10-07T00:00:00Z',repeatCount:++count},error:null};if(input.p_action==='block') stored={created_at:'2026-10-07T00:00:00Z',expires_at:'2026-10-07T00:15:00Z',confidence:input.p_confidence,evidence_ids:[input.p_alert_id]};return{error:null};}};}};
}
test('live syntax aggregation, real handler denial, credential exclusion and storage failure',async()=>{
  const database=databaseMock();let answers=0;
  const web=createLiveWebXdr({database,secret:'test-only',getSource:()=> '192.0.2.8',now:()=> '2026-10-07T00:00:00Z',askJev:async()=>{answers++;return.6;}});
  const safe={query:{path:'recover',q:'select course',password:'<script>credential</script>'},body:{password:'private'}};
  assert.equal(await web.inspect(safe),null);assert.equal(database.calls.length,0);
  let upstream=0;
  const handler=createAuthHandler(async()=>{upstream++;return{ok:false,status:400,json:async()=>({code:'validation_failed'})};},{getXdr:()=>web});
  for(let i=0;i<8;i++){
    const out=response();await handler({method:'POST',query:{path:'recover',q:"' OR 1=1 --"},body:{},headers:{}},out);
    assert.equal(out.statusCode,i===7?429:400);
    if(i===7){assert.equal(out.body.code,'xdr_web_injection');assert.equal(out.headers['Retry-After'],'900');}
  }
  assert.equal(upstream,7);assert.equal(answers,7);
  assert.doesNotMatch(JSON.stringify(database.calls),/OR 1=1|private|192\.0\.2\.8/u);
  const failing=createLiveWebXdr({database:{from(){throw Error('storage');}},secret:'test-only',getSource:()=> '192.0.2.8'});
  const result=response();await createAuthHandler(async()=>{throw Error('must not run');},{getXdr:()=>failing})({method:'POST',query:{path:'recover'},body:{},headers:{}},result);assert.equal(result.statusCode,502);
});
