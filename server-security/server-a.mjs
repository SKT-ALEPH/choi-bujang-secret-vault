import {createServer} from 'node:http';
import {readFile,readFileSync} from 'node:fs';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {signGatewayRequest} from '../src/netbird-gateway.mjs';
import {validateVaultRequest} from '../on-client/student/netbird-vault.mjs';
import {inputSignals} from '../xdr/web-injection/signals.mjs';
import {createManagedAccount} from '../on-client/student/managed-account.mjs';
import {decide as knownCve} from '../xdr/known-cve/decide.mjs';
import {openStore} from './store.mjs';
import {packet,unpack,jsonBody,readJson,send,loadConfig,fault,sha,uuid,checkAssessment} from './common.mjs';

const read=promisify(readFile);
const headerNames=['authorization','content-type','x-aleph-device','x-aleph-at','x-aleph-nonce','x-aleph-signature'];
export function createAccessServer({store,privateKey,bPublicKey,policy,webOrigin,bOrigin,fetchImpl=fetch,allowLocal=false,serveFiles=true}){
  if(new URL(webOrigin).origin!==webOrigin||new URL(webOrigin).protocol!=='https:'&&!allowLocal)throw Error('FIXED_WEB_ORIGIN_REQUIRED');
  let flushing=false;
  async function upstream(path,method,headers,body,signal){
    const proof=signGatewayRequest(privateKey,{method,url:path,headers,body:body||undefined});
    return fetchImpl(webOrigin+path,{method,headers:{...headers,...proof},body:['GET','HEAD'].includes(method)?undefined:body||undefined,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
  }
  async function rpc(path,data,signal){
    const r=await fetchImpl(bOrigin+path,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(packet(privateKey,path,data)),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(policy.assessmentTimeoutMs)]):AbortSignal.timeout(policy.assessmentTimeoutMs)});
    if(!r.ok)throw fault('ASSESSMENT_UNAVAILABLE');return unpack(bPublicKey,path,(await readJson(r)).data,store.consume);
  }
  async function context(input,signal,{completedDelete=false}={}){
    const h=input.headers;
    const preflight={method:input.method,path:input.path,bodyHash:sha(input.body),deviceProof:{id:h['x-aleph-device'],at:h['x-aleph-at'],nonce:h['x-aleph-nonce'],signature:h['x-aleph-signature']},...(completedDelete?{completedDelete:true}:{})};
    const r=await upstream('/api/gateway-context','POST',{'content-type':'application/json',authorization:h.authorization},JSON.stringify(preflight),signal);
    const d=(await readJson(r)).data;if(!r.ok)throw fault(['INVALID_LOGIN','DEVICE_NOT_APPROVED','RESOURCE_NOT_AUTHORIZED'].includes(d.error)?d.error:'AUTHORITY_UNAVAILABLE',r.status===401?401:r.status===403?403:503);
    if(d.schema!=='keshev.gateway.context.v1'||!uuid(d.subjectId)||!uuid(d.deviceCredentialId)||typeof d.sessionId!=='string'||d.sessionId.length>80||typeof d.resource!=='string'
      ||d.operation!==input.method||typeof d.stepUp!=='boolean'||!/^[a-f0-9]{64}$/.test(d.stateVersion)||Date.parse(d.expiresAt)<=Date.now())throw fault('AUTHORITY_UNAVAILABLE');
    return d;
  }
  function enforce(c){
    const rows=store.active(c);
    if(rows.some(r=>r.control==='deny'))throw fault('ACCESS_REVOKED',403);
    if(rows.some(r=>r.control==='require_mfa')&&!c.stepUp)throw fault('STEP_UP_REQUIRED',403);
    return rows.some(r=>r.control==='limit_response');
  }
  function audit(c,{kind,status,bytes=0,reasonCode='NORMAL_REQUEST',webEvent=null}){
    const e={eventId:randomUUID(),requestId:c.requestId,subjectId:c.subjectId??null,sessionId:c.sessionId??null,deviceCredentialId:c.deviceCredentialId??null,
      resource:c.resource??'/api',kind,status,bytes,reasonCode,contextDigest:c.contextDigest??sha(c.requestId),webEvent};
    store.event('server-a',e);store.queue(e);return e.eventId;
  }
  async function flush(){
    if(flushing)return;flushing=true;
    try{for(const e of store.db.prepare('SELECT id,data FROM outbox ORDER BY at LIMIT 50').all()){
      const r=await rpc('/internal/events',JSON.parse(e.data));if(!r.accepted)break;store.db.prepare('DELETE FROM outbox WHERE id=?').run(e.id);
    }}catch{}finally{flushing=false;}
  }
  async function relay(input,{signal,peer='in-process'}={}){
    input.path=validateVaultRequest(input);
    const path=new URL(input.path,'https://fixed.invalid').pathname;
    if(path==='/api/auth'||path==='/api/device'){
      const login=path==='/api/auth'&&new URL(input.path,'https://fixed.invalid').searchParams.get('path')==='token';
      const peerHash=sha(peer);
      if(login&&store.db.prepare('SELECT count(*) n FROM auth_failures WHERE peer=? AND at>?').get(peerHash,Date.now()-policy.windowMs).n>=policy.failedLoginLimit)throw fault('AUTH_RATE_LIMITED',429);
      const r=await upstream(input.path,input.method,input.headers,input.body,signal);
      const result=await readJson(r,131072);
      if(login&&[400,401].includes(r.status)&&['invalid_credentials','invalid_grant'].includes(result.data.code??result.data.error_code))store.db.prepare('INSERT INTO auth_failures VALUES(?,?)').run(peerHash,Date.now());
      return {status:r.status,...result,headers:{}};
    }
    if(typeof input.headers.authorization!=='string'||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.headers.authorization))throw fault('LOGIN_REQUIRED',401);
    let c={requestId:randomUUID()},reservation,bytes=0;
    try{
      c={...c,...await context(input,signal)};
      c.contextDigest=sha(JSON.stringify([c.subjectId,c.sessionId,c.deviceCredentialId,c.resource,c.operation,c.stateVersion,input.path,sha(input.body),policy.version]));
      let limited=enforce(c);
      const signals={...inputSignals(input.path+' '+input.body),knownCve:knownCve({data:{url:input.path,query:input.body},rule:{description:'',level:0}}).action==='block'};
      const counts=store.db.prepare('SELECT count(*) recentRequests,coalesce(sum(bytes),0) recentBytes FROM reservations WHERE subject=? AND at>?').get(c.subjectId,Date.now()-policy.windowMs);
      const signalCount=store.db.prepare("SELECT count(*) n FROM events WHERE subject=? AND at>? AND data LIKE '%WEB_INPUT_ATTACK%'").get(c.subjectId,Date.now()-policy.windowMs).n;
      const evidenceId=audit(c,{kind:'access-decision',status:200,reasonCode:Object.values(signals).some(Boolean)?'WEB_INPUT_ATTACK':'NORMAL_REQUEST'});
      if(policy.requireAssessment||Object.values(signals).some(Boolean)){
        const request={requestId:c.requestId,contextDigest:c.contextDigest,policyVersion:policy.version,subjectId:c.subjectId,sessionId:c.sessionId,
          deviceCredentialId:c.deviceCredentialId,resource:c.resource,operation:c.operation,counts:{...counts,webInputCount:signalCount+(Object.values(signals).some(Boolean)?1:0)},signals,evidenceIds:[evidenceId]};
        let assessment;try{assessment=checkAssessment(await rpc('/internal/evaluate',request,signal),request,policy);}catch(e){throw fault(e.code??'ASSESSMENT_UNAVAILABLE',e.status??503);}
        if(assessment.riskLevel==='unknown')throw fault('ASSESSMENT_UNKNOWN',503);
        if(assessment.recommendedControl==='deny'){
          store.restrict(c,{control:'deny',until:Date.now()+policy.restrictionMs,evidenceId:assessment.assessmentId});throw fault('XDR_ACCESS_DENIED',403);
        }
        if(assessment.recommendedControl==='require_mfa'&&!c.stepUp)throw fault('STEP_UP_REQUIRED',403);
        limited=limited||assessment.recommendedControl==='limit_response';
      }
      const fresh=await context(input,signal);
      if(fresh.subjectId!==c.subjectId||fresh.sessionId!==c.sessionId||fresh.deviceCredentialId!==c.deviceCredentialId||fresh.stateVersion!==c.stateVersion)throw fault('AUTHORITY_CHANGED',403);
      enforce(fresh);
      reservation=store.reserve(c,policy);
      const maxRecords=limited?1:policy.maxRecords;
      const headers={...input.headers,'x-keshev-request-id':c.requestId,'x-keshev-context':c.contextDigest,'x-keshev-max-records':String(maxRecords)};
      const r=await upstream(input.path,input.method,headers,input.body,signal);
      const result=await readJson(r,policy.maxResponseBytes);bytes=result.bytes;
      if(Array.isArray(result.data)&&result.data.length>maxRecords)throw fault('RESPONSE_BUDGET_EXCEEDED',429);
      const raw=r.headers.get('x-keshev-web-event');let webEvent;
      try{webEvent=JSON.parse(Buffer.from(raw,'base64url'));}catch{throw fault('WEB_EVENT_MISSING');}
      if(webEvent?.value?.data?.responseDigest!==sha(JSON.stringify(result.data)))throw fault('WEB_RESPONSE_CHANGED');
      // B authenticates the independently signed API event before any data reaches the accessor.
      const e=audit(c,{kind:'access-result',status:r.status,bytes,webEvent});
      const queued=store.db.prepare("SELECT id,data FROM outbox WHERE json_extract(data,'$.eventId')=?").get(e);
      if(!(await rpc('/internal/events',JSON.parse(queued.data),signal)).accepted)throw fault('AUDIT_UNAVAILABLE');
      store.db.prepare('DELETE FROM outbox WHERE id=?').run(queued.id);
      enforce(c);
      const completedDelete=input.method==='DELETE'&&r.status===200&&result.data?.deleted===true&&result.data.id===new URL(input.path,'https://fixed.invalid').searchParams.get('id');
      const final=await context(input,signal,{completedDelete});
      if(final.stateVersion!==c.stateVersion||final.subjectId!==c.subjectId||final.sessionId!==c.sessionId)throw fault('AUTHORITY_CHANGED',403);
      return {status:r.status,data:result.data,bytes,headers:{'x-keshev-request-id':c.requestId}};
    }catch(e){
      try{audit(c,{kind:'access-result',status:e.status??503,reasonCode:e.code??'ACCESS_UNAVAILABLE'});}catch{}
      throw e;
    }finally{if(reservation)store.finish(reservation,bytes);void flush();}
  }
  const assets=new Map(['index.html','app.js','style.css','device-client.mjs','device-message.mjs','operations.mjs','vendor/supabase.js','auth-config.json','sw.js','offline.html','icon.svg','manifest.webmanifest'].map(s=>['/'+s,s]));
  const server=createServer(async(req,res)=>{
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try{
      if(req.method==='GET'&&req.url==='/health'){send(res,200,{role:'server-a',policyVersion:policy.version,transport:'netbird-required',pendingAudit:store.db.prepare('SELECT count(*) n FROM outbox').get().n});return;}
      if(req.method==='POST'&&req.url==='/api/netbird/account'){
        const account=createManagedAccount({transport:(_path,input)=>relay(input,{signal:controller.signal,peer:req.socket.remoteAddress})});
        const result=await account(await jsonBody(req,2048));send(res,result.status,result.data);return;
      }
      const path=req.url==='/'?'/index.html':req.url;
      if(serveFiles&&req.method==='GET'&&assets.has(path)){
        const bytes=await read(new URL('../public/'+assets.get(path),import.meta.url));
        res.writeHead(200,{'content-type':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.svg')?'image/svg+xml':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(bytes);return;
      }
      if(req.method==='POST'&&req.url==='/api/security/recovery-request'){
        const input=await jsonBody(req,2048);if(!exactRecovery(input))throw fault('INVALID_RECOVERY_REQUEST',400);
        const r=await upstream('/api/auth?path=user','GET',{authorization:req.headers.authorization},'',controller.signal);
        const who=(await readJson(r)).data;if(!r.ok||!uuid(who.id))throw fault('INVALID_LOGIN',401);
        const requestId=randomUUID();audit({requestId,subjectId:who.id},{kind:'recovery-request',status:202,reasonCode:'RECOVERY_REVIEW_REQUESTED'});
        send(res,202,{requested:true,restored:false,requestId});return;
      }
      if(!req.url.startsWith('/api/'))throw fault('NOT_FOUND',404);
      const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>20000)throw fault('INPUT_TOO_LARGE',413);chunks.push(c);}
      const result=await relay({method:req.method,path:req.url,headers:Object.fromEntries(headerNames.filter(k=>typeof req.headers[k]==='string').map(k=>[k,req.headers[k]])),body:Buffer.concat(chunks).toString('utf8')},{signal:controller.signal,peer:req.socket.remoteAddress});
      send(res,result.status,result.data,result.headers);
    }catch(e){send(res,e.code==='ACCOUNT_INPUT_INVALID'?400:e.status??503,{error:e.code??'ACCESS_UNAVAILABLE'});}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  return {server,relay,context,flush};
}
const exactRecovery=x=>x&&Object.keys(x).length===1&&x.requestReview===true;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const c=loadConfig(process.env.KESHEV_CONFIG??'/config/runtime.json'),policy=loadConfig('/app/server-security/policy.local.json');
  const store=openStore('/state/server-a.sqlite');
  const app=createAccessServer({store,privateKey:readFileSync('/state/private.pem','utf8'),bPublicKey:c.bPublicKey,policy,webOrigin:c.webOrigin,bOrigin:`http://${c.bIp}:8091`});
  app.server.listen(8080,c.aIp);
  const timer=setInterval(()=>app.flush(),2000);timer.unref();
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);app.server.close(()=>store.close());app.server.closeAllConnections();});
}
