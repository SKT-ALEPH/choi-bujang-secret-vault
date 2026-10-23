import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, createContext } from 'node:vm';
import { decide } from '../xdr/known-cve/decide.mjs';
import { readAlerts, normalizeAlert } from '../xdr/known-cve/read-alerts.mjs';
import { respond } from '../xdr/known-cve/respond.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';
import { decide as baseDecide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/known-cve.json',import.meta.url)));

test('standalone CVE evaluator: raw/reader, reversed IDs, pattern references and no imports',async()=>{
  const module = new SourceTextModule(await readFile(new URL('../xdr/known-cve/decide.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('IMPORT_FORBIDDEN');});await module.evaluate();
  assert.deepEqual(Object.keys(module.namespace),['decide']);
  const extracted=await readAlerts();assert.equal(extracted.length,fixture.alerts.length);
  const policy=JSON.parse(await readFile(new URL('../xdr/known-cve/patterns.json',import.meta.url)));
  const counts={block:0,alert:0,record:0};
  for(const [index,alert] of [...fixture.alerts].reverse().entries()){
    const out=decide(alert);assert.deepEqual(JSON.parse(JSON.stringify(module.namespace.decide({...alert,id:`changed-${index}`}))),out);
    // Five-field reader intentionally omits request payload. A vague CVE name
    // cannot be promoted to a complete lookup after that evidence is removed.
    const flat=decide(normalizeAlert(alert));
    if(out.action==='block' && !/(?:원격 조회 구문|CVE-2021-44228 형태|문서용 조회 구문)/u.test(alert.rule.description)) assert.equal(flat.action,'alert');
    else assert.deepEqual(flat,out);
    assert.equal(policy.patterns.some(p=>out.reason.startsWith(p.name+':')&&p.evidence.length&&p.condition.length),true);
    assert.deepEqual(Object.keys(normalizeAlert(alert)).sort(),['account','description','level','sourceAddress','timestamp']);
    assert.equal(out.action,out.confidence>=.85?'block':out.confidence>=.5?'alert':'record');counts[out.action]++;
  }
  assert.deepEqual(counts,{block:8,alert:8,record:8});
  for(const input of [null,{},[],{rule:{level:15,mitre:['T1190']}}])assert.equal(decide(input).action,'record');
});

test('CVE words/partial syntax are not blocks; full lookup remains a block independent of level',()=>{
  for(const url of ['/search?q=CVE-2021-44228','/notes?q=jndi','/search?q=${jndi:','/health'])assert.notEqual(decide({rule:{level:15},data:{url}}).action,'block');
  const original=fixture.alerts[0];assert.equal(decide({...original,rule:{level:1},data:{useragent:original.data.useragent}}).action,'block');
  const fakePassword=randomUUID(),fakeBearer=randomUUID();
  const safe=normalizeAlert({rule:{level:6,description:JSON.stringify({password:fakePassword})+' Bearer '+fakeBearer+' email@example.invalid'},data:{srcuser:'email@example.invalid',srcip:'192.0.2.8'}});
  assert.doesNotMatch(JSON.stringify(safe),/email@/u);
  for(const value of [fakePassword,fakeBearer]) assert.equal(JSON.stringify(safe).includes(value),false);
});

test('CVE response: private rules/log dedup, real base integration, normal pass, expiry and prior denial',async()=>{
  const root=await mkdtemp(join(tmpdir(),'xdr03-'));
  try{
    await mkdir(join(root,'xdr/known-cve'),{recursive:true});
    const result={decisions:fixture.alerts.map(a=>({alertId:a.id,...decide(a)}))};
    await respond({root,result,alerts:fixture.alerts});await respond({root,result,alerts:fixture.alerts});
    const rules=await readDenyRules(join(root,'xdr/known-cve/deny-rules.json'));assert.equal(rules.length,8);
    const proof=JSON.parse(await readFile(join(root,'xdr/known-cve/verification.json')));
    assert.equal(proof.blockedCandidates,8);assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.normalEventsPassed,8);
    const log=await readFile(join(root,'xdr/alerts.log'),'utf8');assert.equal(log.trim().split('\n').length,8);assert.doesNotMatch(log,/203\.0\.113|user01|jndi:ldap/u);
    const rule=rules[0];const {normal,suspicious}=fixtureRequests();
    let source=rule.sourceAddress,at=rule.createdAt;
    const connected=connectXdrDecider({getTrustedSource:async()=>source,getRules:()=>readDenyRules(join(root,'xdr/known-cve/deny-rules.json')),denyReasonCode:'xdr_known_cve',allowedReasonCodes:['xdr_known_cve'],now:()=>at});
    assert.equal((await connected.decide(normal)).decision,'deny');
    for(const input of [suspicious,{...normal,deviceRegistered:false},{...normal,method:'POST'}])assert.deepEqual(await connected.decide(input),await baseDecide(input));
    source='192.0.2.200';assert.equal((await connected.decide(normal)).decision,'allow');
    source=rule.sourceAddress;at=new Date(Math.max(...rules.filter(r=>r.sourceAddress===source).map(r=>Date.parse(r.expiresAt)))).toISOString();assert.equal((await connected.decide(normal)).decision,'allow');
    assert.equal(Date.parse(rule.expiresAt)-Date.parse(rule.createdAt),900000);
  }finally{await rm(root,{recursive:true,force:true});}
});
