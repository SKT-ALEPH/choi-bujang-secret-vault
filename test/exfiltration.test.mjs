import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceTextModule, createContext } from 'node:vm';
import { decide } from '../xdr/exfiltration/decide.mjs';
import { readAlerts, normalizeAlert } from '../xdr/exfiltration/read-alerts.mjs';
import { respond } from '../xdr/exfiltration/respond.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';
import { decide as baseDecide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/exfiltration.json',import.meta.url)));

test('standalone exfiltration evaluator: raw/reader, reversed IDs, pattern references and no imports',async()=>{
  const module = new SourceTextModule(await readFile(new URL('../xdr/exfiltration/decide.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('IMPORT_FORBIDDEN');});await module.evaluate();
  assert.deepEqual(Object.keys(module.namespace),['decide']);
  const extracted=await readAlerts();assert.equal(extracted.length,fixture.alerts.length);
  const policy=JSON.parse(await readFile(new URL('../xdr/exfiltration/patterns.json',import.meta.url)));
  const counts={block:0,alert:0,record:0};
  for(const [index,alert] of [...fixture.alerts].reverse().entries()){
    const out=decide(alert);assert.deepEqual(JSON.parse(JSON.stringify(module.namespace.decide({...alert,id:`changed-${index}`}))),out);
    const flat=decide(normalizeAlert(alert));
    // Destination/bytes/files are deliberately outside the five-field reader.
    assert.ok(flat.confidence<=out.confidence);
    assert.equal(['block','alert','record'].includes(flat.action),true);
    assert.equal(policy.patterns.some(p=>out.reason.startsWith(p.name+':')&&p.evidence.length&&p.condition.length),true);
    assert.deepEqual(Object.keys(normalizeAlert(alert)).sort(),['account','description','level','sourceAddress','timestamp']);
    assert.equal(out.action,out.confidence>=.85?'block':out.confidence>=.5?'alert':'record');counts[out.action]++;
  }
  assert.deepEqual(counts,{block:10,alert:10,record:10});
  for(const input of [null,{},[],{rule:{level:15,mitre:['T1190']}}])assert.equal(decide(input).action,'record');
});

test('exfiltration needs bulk transfer and anomalous context, not bytes, a destination or severity alone',()=>{
  const row=(description,bytes,files=1)=>({rule:{level:15,description},data:{bytes:String(bytes),files:String(files)}});
  assert.equal(decide(row('처음 보는 목적지로 파일이 전송됐습니다.',50000000)).action,'block');
  assert.equal(decide(row('처음 보는 목적지로 파일이 전송됐습니다.',49999999)).action,'alert');
  assert.notEqual(decide(row('평소 백업 주소로 승인된 파일이 전송됐습니다.',300000000)).action,'block');
  assert.notEqual(decide(row('처음 보는 목적지로 전송이 실패로 끝났습니다.',300000000)).action,'block');
  assert.equal(decide({rule:{level:15,mitre:['T1041','T1048']},data:{bytes:'NaN'}}).action,'record');
});

test('exfiltration response: private rules/log dedup, real base integration, normal pass, expiry and prior denial',async()=>{
  const root=await mkdtemp(join(tmpdir(),'xdr06-'));
  try{
    await mkdir(join(root,'xdr/exfiltration'),{recursive:true});
    const result={decisions:fixture.alerts.map(a=>({alertId:a.id,...decide(a)}))};
    await respond({root,result,alerts:fixture.alerts});await respond({root,result,alerts:fixture.alerts});
    const rules=await readDenyRules(join(root,'xdr/exfiltration/deny-rules.json'));assert.equal(rules.length,10);
    const proof=JSON.parse(await readFile(join(root,'xdr/exfiltration/verification.json')));
    assert.equal(proof.blockedCandidates,10);assert.equal(proof.normalEventsBlocked,0);assert.equal(proof.normalEventsPassed,10);
    const log=await readFile(join(root,'xdr/alerts.log'),'utf8');assert.equal(log.trim().split('\n').length,10);assert.doesNotMatch(log,/203\.0\.113|user01|jndi:ldap/u);
    const rule=rules[0];const {normal,suspicious}=fixtureRequests();
    let source='192.0.2.200',at=rule.createdAt,destination=rule.destinationAddress;
    const connected=connectXdrDecider({getTrustedSource:async()=>source,getTrustedDestination:async()=>destination,getRules:()=>readDenyRules(join(root,'xdr/exfiltration/deny-rules.json')),denyReasonCode:'xdr_exfiltration',allowedReasonCodes:['xdr_exfiltration'],now:()=>at});
    assert.equal((await connected.decide(normal)).decision,'deny');
    for(const input of [suspicious,{...normal,deviceRegistered:false},{...normal,method:'POST'}])assert.deepEqual(await connected.decide(input),await baseDecide(input));
    source='192.0.2.201';assert.equal((await connected.decide(normal)).decision,'deny');
    destination='192.0.2.200';assert.equal((await connected.decide(normal)).decision,'allow');
    const missing=connectXdrDecider({getTrustedSource:async()=>source,getRules:async()=>rules,denyReasonCode:'xdr_exfiltration',allowedReasonCodes:['xdr_exfiltration'],now:()=>at});
    await assert.rejects(()=>missing.decide(normal),/XDR_TRUSTED_DESTINATION_REQUIRED/);
    destination=rule.destinationAddress;at=new Date(Math.max(...rules.filter(r=>r.destinationAddress===destination).map(r=>Date.parse(r.expiresAt)))).toISOString();assert.equal((await connected.decide(normal)).decision,'allow');
    assert.equal(Date.parse(rule.expiresAt)-Date.parse(rule.createdAt),900000);
  }finally{await rm(root,{recursive:true,force:true});}
});
