import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAlerts, normalizeAlert } from '../xdr/brute-force/read-alerts.mjs';
import { createDecider } from '../xdr/brute-force/decide.mjs';
import { respond } from '../xdr/brute-force/respond.mjs';
import { createXdrGuard } from '../xdr/brute-force/guard.mjs';
import { decide as originalDecide } from '../src/decider.mjs';
import { createJevClient } from '../xdr/brute-force/jev.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/brute-force.json', import.meta.url), 'utf8'));
const sample = (description, level=5, id='sample', timestamp='2026-10-07T00:00:00Z') => ({ id, timestamp,
  rule:{ description, level }, data:{ srcip:'192.0.2.120', srcuser:'user01' } });

test('official Jev adapter requires opt-in and a key, sends only whitelisted evidence and rejects unsafe responses', async()=>{
  let calls=0;
  const summary={level:6,failureCount:4,accountCount:1,multiAccount:false,samePassword:false,
    account:'private-fixture-account',description:'private-fixture-text'};
  const fetchImpl=async(url,options)=>{
    calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);assert.equal(body.model,'jev-latest');
    assert.deepEqual(Object.keys(body.state).sort(),['accountCount','failureCount','level','multiAccount','samePassword']);
    assert.equal(JSON.stringify(body).includes('private-fixture'),false);
    return {ok:true,json:async()=>({answers:{is_brute_force:{type:'noul',noul:0.7}}})};
  };
  assert.equal(await createJevClient({enabled:false,getApiKey:()=> 'test-only',fetchImpl})(summary),null);
  assert.equal(await createJevClient({enabled:true,getApiKey:()=>'',fetchImpl})(summary),null);assert.equal(calls,0);
  assert.equal(await createJevClient({enabled:true,getApiKey:()=> 'test-only',fetchImpl})(summary),0.7);assert.equal(calls,1);
  for (const response of [{ok:false}, {ok:true,json:async()=>({answers:{is_brute_force:{type:'noul',noul:2}}})},
    {ok:true,json:async()=>({answers:{is_brute_force:{type:'choice',noul:0.9}}})}]) {
    assert.equal(await createJevClient({enabled:true,getApiKey:()=> 'test-only',fetchImpl:async()=>response})(summary),null);
  }
});

test('reader emits five fields for every alert and redacts credentials and personal account names', async()=>{
  const rows=await readAlerts(); assert.equal(rows.length,fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]).sort(),['account','description','level','sourceAddress','timestamp']);
  const original=sample('password=private-fixture-value\n token=private-fixture-token {"api_key":"private-fixture-key"}');original.data.srcuser='private fixture account';
  const out=normalizeAlert(original);assert.equal(JSON.stringify(out).includes('private-fixture'),false);
  assert.equal(JSON.stringify(out).includes('private fixture account'),false);assert.ok(out.account.startsWith('opaque:'));
  assert.equal(out.description.includes('\n'),false); assert.equal(original.data.srcuser,'private fixture account');
});

test('clear evidence and normal activity skip Jev; ambiguous input uses only sanitized evidence', async()=>{
  let calls=0;
  const decide=createDecider({askJev:async summary=>{ calls++;assert.deepEqual(Object.keys(summary).sort(),
    ['accountCount','failureCount','level','multiAccount','pattern','samePassword']);return 0.7; }});
  assert.equal((await decide(sample('로그인 실패 48건입니다.',12))).action,'block');
  assert.equal((await decide(sample('로그인이 성공했습니다.',3))).action,'record');assert.equal(calls,0);
  assert.equal((await decide(sample('로그인 실패 4건 뒤 성공했습니다.',6))).action,'alert');assert.equal(calls,1);
  for(const [score,action] of [[0.85,'block'],[0.5,'alert'],[0.49,'record']]) {
    const judge=createDecider({askJev:async()=>score}); assert.equal((await judge(sample('로그인 실패 4건 뒤 성공했습니다.'))).action,action);
  }
});

test('Jev errors, invalid scores and timeouts cannot automatically block ambiguous events', async()=>{
  for(const askJev of [async()=>null,async()=>NaN,async()=>1.1,async()=>{throw new Error('unavailable');},()=>new Promise(()=>{})]) {
    const decide=createDecider({askJev,timeoutMs:10});const out=await decide(sample('로그인 실패 5건입니다.'));
    assert.equal(out.action,'alert');assert.equal(out.confidence,0.5);
  }
});

test('correlation ignores duplicates and expired events, and does not mix accounts',async()=>{
  const decide=createDecider();
  const a=sample('로그인 실패 10건입니다.',5,'a');
  const b=sample('로그인 실패 10건입니다.',5,'b','2026-10-07T00:00:01Z');
  assert.equal((await decide(a)).action,'alert'); assert.equal((await decide(a)).action,'alert');
  const other=structuredClone(b); other.data.srcuser='user02'; assert.equal((await decide(other)).action,'alert');
  assert.equal((await decide(b)).action,'block');
  assert.equal((await decide(sample('로그인 실패 10건입니다.',5,'c','2026-10-07T00:03:00Z'))).action,'alert');
});

test('replay classifies evidence rather than IDs and produces no normal blocks or repeated log lines',async()=>{
  const decide=createDecider();const decisions=[];
  // IDs and input order are deliberately changed; no answer table is used.
  for(const [index,alert] of [...fixture.alerts].reverse().entries()) {
    const cloned=structuredClone(alert);cloned.id='renamed-'+index;
    const out=await decide(cloned);decisions.push({alertId:alert.id,...out});
    if(alert.rule.level<=3)assert.equal(out.action,'record');
    if(alert.rule.level>=10)assert.equal(out.action,'block');
    if(alert.rule.level>=5 && alert.rule.level<=8)assert.equal(out.action,'alert');
  }
  const result={decisions,counts:{block:10,alert:9,record:9}};
  const root=await mkdtemp(join(tmpdir(),'brute-force-'));
  try {
    await mkdir(join(root,'xdr/brute-force'),{recursive:true});
    await respond({root,result,alerts:fixture.alerts});await respond({root,result,alerts:fixture.alerts});
    const proof=JSON.parse(await readFile(join(root,'xdr/brute-force/verification.json'),'utf8'));
    assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.blockedCandidates,10);
    assert.equal((await readFile(join(root,'xdr/alerts.log'),'utf8')).trim().split('\n').length,9);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('guard uses a trusted source, preserves base rules and request contract, and stops denying at expiry',async()=>{
  const rules=[{action:'deny',sourceAddress:'192.0.2.120',confidence:0.9,createdAt:'2026-10-07T00:00:00Z',
    expiresAt:'2026-10-07T00:15:00Z',evidenceAlertIds:['sample']}];
  const request={requestId:'request-1',untrustedIp:'192.0.2.120'};const snapshot=structuredClone(request);
  const base=async req=>({schema:'aleph.decision.v1',requestId:req.requestId,decision:'allow',reasonCode:'approved',ruleIds:['base.allow']});
  const guard=(source,at,decide=base)=>createXdrGuard(decide,{getTrustedSource:async id=>{assert.equal(id,request.requestId);return source;},getRules:async()=>rules,now:()=>at});
  const blocked=await guard('192.0.2.120','2026-10-07T00:01:00Z')(request);
  assert.equal(blocked.decision,'deny');assert.equal(Object.keys(blocked).length,5);
  assert.deepEqual(await guard('192.0.2.121','2026-10-07T00:01:00Z')(request),await base(request));
  assert.equal((await guard(null,'2026-10-07T00:01:00Z')(request)).decision,'allow');
  assert.equal((await guard('192.0.2.120','2026-10-07T00:15:00Z')(request)).decision,'allow');
  assert.deepEqual(await guard(null,'2026-10-07T00:01:00Z',originalDecide)(request),await originalDecide(request));
  assert.deepEqual(request,snapshot);
});
