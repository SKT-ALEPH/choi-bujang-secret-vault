import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {decide,RULE_IDS} from './decider.mjs';
import {detect} from './detect.mjs';
import {fixtureRequests} from '../scripts/fixture-7.mjs';
import {loadSafePolicy} from './recovery-policy.mjs';

// Only named, fixed synthetic inputs. Never accept a caller-supplied request/event.
export const CHECK_CASES=Object.freeze({
 's06-normal':[6,'normal','allow'], 's06-unregistered':[6,'forbidden','deny'],
 's07-normal':[7,'normal','allow'], 's07-compound':[7,'forbidden','step_up'],
 's07-confirmed':[7,'normal','allow'],
 's08-normal':[8,'normal','allow'], 's08-unknown-route':[8,'forbidden','deny'],
 's08-all-notes':[8,'forbidden','deny'], 's08-write-notice':[8,'forbidden','deny'],
 's09-normal':[9,'normal','observe'], 's09-burst-read':[9,'forbidden','propose_revocation'],
});
export async function runFixedCheck(name){
 if(!Object.hasOwn(CHECK_CASES,name))return null;const definition=CHECK_CASES[name];
 const [stage,type,expected]=definition,{normal,suspicious}=fixtureRequests();
 let actual,reasonCode,ruleIds=[],eventCount=null;
 if(stage===9){
  eventCount=name==='s09-normal'?120:121;
  const result=detect(Array.from({length:eventCount},(_,i)=>({at:new Date(1800000000000+i*1000).toISOString(),method:'GET',identity:{sub:'synthetic-operations-subject'}})));
  actual=result.action;reasonCode=result.reasonCode??'within_limit';
 }else{
  let input=normal;
  if(name==='s06-unregistered')input={...normal,deviceRegistered:false};
  if(name==='s07-compound')input=suspicious;
  if(name==='s07-confirmed')input={...suspicious,stepUp:{verified:true,authAgeSeconds:60}};
  if(name==='s08-unknown-route')input={...normal,path:'/notes/export'};
  if(name==='s08-all-notes')input={...normal,path:'/notes',route:'GET /notes'};
  if(name==='s08-write-notice')input={...normal,service:'announcements',method:'PUT',path:'/announcements/demo',route:'PUT /announcements/:id'};
  const result=await decide(input);actual=result.decision;reasonCode=result.reasonCode;ruleIds=result.ruleIds;
 }
 return{caseId:name,stage,type,kind:'synthetic_input_over_http',expected,actual,reasonCode,ruleIds,eventCount,
  ready:actual===expected&&ruleIds.every(id=>RULE_IDS.includes(id)),requestId:randomUUID(),checkedAt:new Date().toISOString()};
}

// The public report contains test receipts, never production user data.
export async function operationsReport(){
 const proof=JSON.parse(await readFile(new URL('../config/operations-verification.json',import.meta.url),'utf8'));
 if(proof.schema!=='aleph.operations.v1'||!Array.isArray(proof.records))throw Error('INVALID_OPERATIONS_RECORD');
 const policy=await loadSafePolicy();
 return{schema:proof.schema,requestId:randomUUID(),checkedAt:new Date().toISOString(),
  rules:[...RULE_IDS],policy:{version:policy.version,sourceCommit:policy.sourceCommit,hash:policy.policyHash,verified:true},
  verification:proof,engine:{name:'ALEPH SDP 엔진',scope:'제공 엔진의 가명 사건 전달·판정 집행·회수는 운영 심판 검증 범위'},
  detection:{kind:'synthetic_input_over_http',productionEvents:'not_measured',records:proof.records.filter(r=>r.stage===9&&r.kind==='synthetic_input_over_http')},
  revocation:{kind:'live_api_protocol',records:proof.records.filter(r=>r.caseId==='revoked_device_denied')},
  recovery:{kind:'live_api_protocol',records:proof.records.filter(r=>r.stage===10)},
  summary:{executed:proof.records.filter(r=>r.result!=='not_run').length,
   passed:proof.records.filter(r=>r.result==='passed').length,failed:proof.records.filter(r=>r.result==='failed').length,
   notRun:proof.records.filter(r=>r.result==='not_run').length}};
}
