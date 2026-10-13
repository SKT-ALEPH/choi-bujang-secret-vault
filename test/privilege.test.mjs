import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, createContext } from 'node:vm';
import { decide } from '../xdr/privilege/decide.mjs';
import { readAlerts, normalizeAlert } from '../xdr/privilege/read-alerts.mjs';
import { respond } from '../xdr/privilege/respond.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';
import { decide as baseDecide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/privilege.json',import.meta.url)));

test('standalone privilege evaluator: raw/reader, reversed IDs, pattern references and no imports',async()=>{
  const module = new SourceTextModule(await readFile(new URL('../xdr/privilege/decide.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('IMPORT_FORBIDDEN');});await module.evaluate();
  assert.deepEqual(Object.keys(module.namespace),['decide']);
  const extracted=await readAlerts();assert.equal(extracted.length,fixture.alerts.length);
  const policy=JSON.parse(await readFile(new URL('../xdr/privilege/patterns.json',import.meta.url)));
  const counts={block:0,alert:0,record:0};
  for(const [index,alert] of [...fixture.alerts].reverse().entries()){
    const out=decide(alert);assert.deepEqual(JSON.parse(JSON.stringify(module.namespace.decide({...alert,id:`changed-${index}`}))),out);
    assert.deepEqual(decide(normalizeAlert(alert)),out);
    assert.equal(policy.patterns.some(p=>out.reason.startsWith(p.name+':')&&p.evidence.length&&p.condition.length),true);
    assert.deepEqual(Object.keys(normalizeAlert(alert)).sort(),['account','description','level','sourceAddress','timestamp']);
    assert.equal(out.action,out.confidence>=.85?'block':out.confidence>=.5?'alert':'record');counts[out.action]++;
  }
  assert.deepEqual(counts,{block:9,alert:8,record:9});
  for(const input of [null,{},[],{rule:{level:15,mitre:['T1190']}}])assert.equal(decide(input).action,'record');
});

test('privilege needs administrator change/use and anomalous context, not group names or severity alone',()=>{
  for(const description of ['관리자 명령이 실패 1건으로 끝났습니다.','관리자 그룹은 아닙니다. 과제 그룹에 추가됐습니다.','수업 시간 권한 상승 창이 취소됐습니다.','그룹 목록을 읽기만 했습니다.'])assert.notEqual(decide({rule:{level:15,description},data:{group:'administrators'}}).action,'block');
  assert.equal(decide({rule:{level:1,description:'평범한 계정이 원격 주소에서 관리자 그룹에 추가됐습니다.'}}).action,'block');
  assert.equal(decide({rule:{level:15,mitre:['T1068','T1078']},data:{group:'administrators'}}).action,'record');
});

test('privilege response: private rules/log dedup, real base integration, normal pass, expiry and prior denial',async()=>{
  const root=await mkdtemp(join(tmpdir(),'xdr05-'));
  try{
    await mkdir(join(root,'xdr/privilege'),{recursive:true});
    const result={decisions:fixture.alerts.map(a=>({alertId:a.id,...decide(a)}))};
    await respond({root,result,alerts:fixture.alerts});await respond({root,result,alerts:fixture.alerts});
    const rules=await readDenyRules(join(root,'xdr/privilege/deny-rules.json'));assert.equal(rules.length,9);
    const proof=JSON.parse(await readFile(join(root,'xdr/privilege/verification.json')));
    assert.equal(proof.blockedCandidates,9);assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.normalEventsPassed,9);
    const log=await readFile(join(root,'xdr/alerts.log'),'utf8');assert.equal(log.trim().split('\n').length,8);assert.doesNotMatch(log,/203\.0\.113|user01|jndi:ldap/u);
    const rule=rules[0];const {normal,suspicious}=fixtureRequests();
    let source=rule.sourceAddress,at=rule.createdAt,account=rule.account;
    const connected=connectXdrDecider({getTrustedSource:async()=>source,getTrustedAccount:async()=>account,getRules:()=>readDenyRules(join(root,'xdr/privilege/deny-rules.json')),denyReasonCode:'xdr_privilege',allowedReasonCodes:['xdr_privilege'],now:()=>at});
    assert.equal((await connected.decide(normal)).decision,'deny');
    for(const input of [suspicious,{...normal,deviceRegistered:false},{...normal,method:'POST'}])assert.deepEqual(await connected.decide(input),await baseDecide(input));
    account='user999';assert.equal((await connected.decide(normal)).decision,'allow');account=rule.account;
    const missing=connectXdrDecider({getTrustedSource:async()=>source,getRules:async()=>rules,denyReasonCode:'xdr_privilege',allowedReasonCodes:['xdr_privilege'],now:()=>at});
    await assert.rejects(()=>missing.decide(normal),/XDR_TRUSTED_ACCOUNT_REQUIRED/);
    source='192.0.2.200';assert.equal((await connected.decide(normal)).decision,'allow');
    source=rule.sourceAddress;at=new Date(Math.max(...rules.filter(r=>r.sourceAddress===source).map(r=>Date.parse(r.expiresAt)))).toISOString();assert.equal((await connected.decide(normal)).decision,'allow');
    assert.equal(Date.parse(rule.expiresAt)-Date.parse(rule.createdAt),900000);
  }finally{await rm(root,{recursive:true,force:true});}
});
