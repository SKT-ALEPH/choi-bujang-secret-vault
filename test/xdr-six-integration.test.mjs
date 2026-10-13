import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readDenyRules, addDenyRules } from '../xdr/brute-force/rule-store.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';
import { decide as baseDecide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
const keys=['brute-force','web-injection','known-cve','persistence','privilege','exfiltration'];

test('all six persisted responders compose with the real decider, preserve denials and expire without broad account/destination blocks',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'xdr-six-'));
  try{
    const rules=[];
    for(const key of keys){
      await mkdir(join(temporary,'xdr',key),{recursive:true});
      const fixture=JSON.parse(await readFile(new URL(`../xdr/fixtures/${key}.json`,import.meta.url)));
      const {decide}=await import(new URL(`../xdr/${key}/decide.mjs`,import.meta.url));
      const {respond}=await import(new URL(`../xdr/${key}/respond.mjs`,import.meta.url));
      const decisions=[];for(const row of fixture.alerts)decisions.push({alertId:row.id,...await decide(row)});
      await respond({root:temporary,result:{decisions},alerts:fixture.alerts});
      const proof=JSON.parse(await readFile(join(temporary,'xdr',key,'verification.json')));
      assert.equal(proof.normalEventsBlocked,0,key);assert.equal(proof.blockedCandidates,decisions.filter(d=>d.action==='block').length,key);
      rules.push(...await readDenyRules(join(temporary,'xdr',key,'deny-rules.json')));
    }
    assert.equal(rules.length,53);
    const path=join(temporary,'xdr','all-private-rules.json');await addDenyRules(path,rules);
    assert.equal((await readDenyRules(path)).length,53);
    let source='192.0.2.250',account='user999',destination='192.0.2.251',at=rules[0].createdAt;
    const connected=connectXdrDecider({getRules:()=>readDenyRules(path),getTrustedSource:async()=>source,getTrustedAccount:async()=>account,getTrustedDestination:async()=>destination,denyReasonCode:'xdr_blocked',allowedReasonCodes:['xdr_blocked'],now:()=>at});
    const {normal,suspicious}=fixtureRequests();const before=structuredClone(normal);
    assert.equal((await connected.decide(normal)).decision,'allow');
    for(const rule of rules){
      source=rule.sourceAddress??'192.0.2.250';account=rule.account??'user999';destination=rule.destinationAddress??'192.0.2.251';at=rule.createdAt;
      assert.equal((await connected.decide(normal)).decision,'deny',rule.ruleId);
      for(const input of [suspicious,{...normal,deviceRegistered:false},{...normal,path:'/admin'}])assert.deepEqual(await connected.decide(input),await baseDecide(input));
    }
    at=new Date(Math.max(...rules.map(r=>Date.parse(r.expiresAt)))).toISOString();
    assert.equal((await connected.decide(normal)).decision,'allow');assert.deepEqual(normal,before);
    // Rule kinds cannot substitute one target for another or omit the account.
    const destRule=rules.find(r=>r.destinationAddress);
    await assert.rejects(()=>addDenyRules(path,[{...destRule,sourceAddress:'192.0.2.250'}]),/XDR_RULE_STORE_INVALID/);
    const accountRule=rules.find(r=>r.account);const {account:omitted,...withoutAccount}=accountRule;
    await assert.rejects(()=>addDenyRules(path,[withoutAccount]),/XDR_RULE_STORE_INVALID/);
  }finally{await rm(temporary,{recursive:true,force:true});}
});
