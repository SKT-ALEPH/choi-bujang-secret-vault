import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, createContext } from 'node:vm';
import { decide } from '../xdr/persistence/decide.mjs';
import { readAlerts, normalizeAlert } from '../xdr/persistence/read-alerts.mjs';
import { respond } from '../xdr/persistence/respond.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';
import { decide as baseDecide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/persistence.json',import.meta.url)));

test('standalone persistence evaluator: raw/reader, reversed IDs, pattern references and no imports',async()=>{
  const module = new SourceTextModule(await readFile(new URL('../xdr/persistence/decide.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('IMPORT_FORBIDDEN');});await module.evaluate();
  assert.deepEqual(Object.keys(module.namespace),['decide']);
  const extracted=await readAlerts();assert.equal(extracted.length,fixture.alerts.length);
  const policy=JSON.parse(await readFile(new URL('../xdr/persistence/patterns.json',import.meta.url)));
  const counts={block:0,alert:0,record:0};
  for(const [index,alert] of [...fixture.alerts].reverse().entries()){
    const out=decide(alert);assert.deepEqual(JSON.parse(JSON.stringify(module.namespace.decide({...alert,id:`changed-${index}`}))),out);
    assert.deepEqual(decide(normalizeAlert(alert)),out);
    assert.equal(policy.patterns.some(p=>out.reason.startsWith(p.name+':')&&p.evidence.length&&p.condition.length),true);
    assert.deepEqual(Object.keys(normalizeAlert(alert)).sort(),['account','description','level','sourceAddress','timestamp']);
    assert.equal(out.action,out.confidence>=.85?'block':out.confidence>=.5?'alert':'record');counts[out.action]++;
  }
  assert.deepEqual(counts,{block:8,alert:8,record:8});
  for(const input of [null,{},[],{rule:{level:15,mitre:['T1190']}}])assert.equal(decide(input).action,'record');
});

test('persistence requires a changed execution mechanism, not severity, a temp file or unknown signature alone',()=>{
  for(const description of ['서명은 아직 모르는 수업 도구입니다.','임시 폴더에 실행 파일이 하나 생겼습니다. 서비스 등록은 없습니다.','서비스 설명만 바뀌었습니다. 실행 파일은 그대로입니다.','기존 수업 도구 서비스가 서명된 채로 실행 중입니다.'])assert.notEqual(decide({rule:{level:15,description}}).action,'block');
  assert.equal(decide({rule:{level:1,description:'서명 없는 새 서비스가 임시 폴더의 실행 파일을 가리킵니다.'}}).action,'block');
  assert.equal(decide({rule:{level:15,mitre:['T1543','T1053']}}).action,'record');
});

test('persistence response: private rules/log dedup, real base integration, normal pass, expiry and prior denial',async()=>{
  const root=await mkdtemp(join(tmpdir(),'xdr04-'));
  try{
    await mkdir(join(root,'xdr/persistence'),{recursive:true});
    const result={decisions:fixture.alerts.map(a=>({alertId:a.id,...decide(a)}))};
    await respond({root,result,alerts:fixture.alerts});await respond({root,result,alerts:fixture.alerts});
    const rules=await readDenyRules(join(root,'xdr/persistence/deny-rules.json'));assert.equal(rules.length,8);
    const proof=JSON.parse(await readFile(join(root,'xdr/persistence/verification.json')));
    assert.equal(proof.blockedCandidates,8);assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.normalEventsPassed,8);
    const log=await readFile(join(root,'xdr/alerts.log'),'utf8');assert.equal(log.trim().split('\n').length,8);assert.doesNotMatch(log,/203\.0\.113|user01|jndi:ldap/u);
    const rule=rules[0];const {normal,suspicious}=fixtureRequests();
    let source=rule.sourceAddress,at=rule.createdAt;
    const connected=connectXdrDecider({getTrustedSource:async()=>source,getRules:()=>readDenyRules(join(root,'xdr/persistence/deny-rules.json')),denyReasonCode:'xdr_persistence',allowedReasonCodes:['xdr_persistence'],now:()=>at});
    assert.equal((await connected.decide(normal)).decision,'deny');
    for(const input of [suspicious,{...normal,deviceRegistered:false},{...normal,method:'POST'}])assert.deepEqual(await connected.decide(input),await baseDecide(input));
    source='192.0.2.200';assert.equal((await connected.decide(normal)).decision,'allow');
    source=rule.sourceAddress;at=new Date(Math.max(...rules.filter(r=>r.sourceAddress===source).map(r=>Date.parse(r.expiresAt)))).toISOString();assert.equal((await connected.decide(normal)).decision,'allow');
    assert.equal(Date.parse(rule.expiresAt)-Date.parse(rule.createdAt),900000);
  }finally{await rm(root,{recursive:true,force:true});}
});
