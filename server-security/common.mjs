import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const sha=value=>createHash('sha256').update(value).digest('hex');
export const fault=(code,status=503)=>Object.assign(Error(code),{code,status});
export const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
export const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export const reasonCodes=['NORMAL_REQUEST','REPEATED_AUTH_FAILURES','WEB_INPUT_ATTACK','KNOWN_CVE_REQUEST','UNUSUAL_BULK_READ','SERVER_INTEGRITY_ALERT','EVIDENCE_UNAVAILABLE','AI_REQUIRED_UNAVAILABLE','MONITOR_UNAVAILABLE'];
export const controls=['none','require_mfa','limit_response','deny'];
export function packet(privateKey,scope,data){
  const value={scope,at:Date.now(),nonce:randomUUID(),data};
  return {value,signature:sign(null,Buffer.from(JSON.stringify(value)),privateKey).toString('base64url')};
}
export function unpack(publicKey,scope,p,consume,now=Date.now(),maxAgeMs=30000){
  if(!exact(p,['value','signature'])||!exact(p.value,['scope','at','nonce','data'])||p.value.scope!==scope
    ||!Number.isSafeInteger(p.value.at)||now-p.value.at>maxAgeMs||p.value.at>now+30000||!uuid(p.value.nonce)
    ||typeof p.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(p.signature)
    ||!verify(null,Buffer.from(JSON.stringify(p.value)),publicKey,Buffer.from(p.signature,'base64url')))throw fault('SERVICE_PROOF_REJECTED',403);
  consume(p.value.nonce);return p.value.data;
}
export function keyFromSecret(secret){return createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(sha('keshev.web-event.v1:'+secret),'hex')]),format:'der',type:'pkcs8'});}
export function publicPem(privateKey){return createPublicKey(privateKey).export({format:'pem',type:'spki'});}
export async function jsonBody(request,limit=65536){
  const chunks=[];let count=0;
  for await(const chunk of request){count+=chunk.length;if(count>limit)throw fault('INPUT_TOO_LARGE',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault('INVALID_JSON',400);}
}
export async function readJson(response,limit=65536){
  const chunks=[];let count=0;
  if(!response.body)throw fault('INVALID_RESPONSE');
  const reader=response.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>limit)throw fault('RESPONSE_BUDGET_EXCEEDED',429);chunks.push(value);}}
  finally{await reader.cancel();}
  try{return {data:JSON.parse(Buffer.concat(chunks).toString('utf8')),bytes:count};}catch{throw fault('INVALID_RESPONSE');}
}
export function send(res,status,data,headers={}){
  if(res.writableEnded||res.destroyed)return;
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers});
  res.end(JSON.stringify(data));
}
export const loadConfig=path=>JSON.parse(readFileSync(path,'utf8'));
export function checkAssessment(a,request,policy,now=Date.now()){
  if(!exact(a,['schema','assessmentId','requestId','contextDigest','policyVersion','riskLevel','recommendedControl','reasonCodes','evidenceIds','evaluatedAt','validUntil'])
    ||a.schema!=='keshev.risk.assessment.v1'||!uuid(a.assessmentId)||a.requestId!==request.requestId||a.contextDigest!==request.contextDigest||a.policyVersion!==policy.version
    ||!['low','medium','high','unknown'].includes(a.riskLevel)||!controls.includes(a.recommendedControl)
    ||!Array.isArray(a.reasonCodes)||!a.reasonCodes.length||a.reasonCodes.length>8||!a.reasonCodes.every(c=>reasonCodes.includes(c))
    ||!Array.isArray(a.evidenceIds)||a.evidenceIds.length>16||!a.evidenceIds.every(uuid)
    ||!Number.isFinite(Date.parse(a.evaluatedAt))||!Number.isFinite(Date.parse(a.validUntil))
    ||Date.parse(a.evaluatedAt)>now+1000||Date.parse(a.validUntil)<=now||Date.parse(a.validUntil)-Date.parse(a.evaluatedAt)>policy.assessmentTtlMs
    ||now-Date.parse(a.evaluatedAt)>policy.assessmentTtlMs)throw fault('ASSESSMENT_REJECTED',403);
  return a;
}
