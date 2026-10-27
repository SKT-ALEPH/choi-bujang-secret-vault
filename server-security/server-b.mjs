import {createServer} from 'node:http';
import {readFileSync,statSync,openSync,readSync,closeSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {openStore} from './store.mjs';
import {packet,unpack,jsonBody,readJson,send,loadConfig,fault,exact,uuid,controls,reasonCodes,sha} from './common.mjs';
import {saveBackup} from './backup.mjs';

const requestKeys=['requestId','contextDigest','policyVersion','subjectId','sessionId','deviceCredentialId','resource','operation','counts','signals','evidenceIds'];
export function createAssessmentServer({store,privateKey,aPublicKey,policy,webOrigin,ai,fetchImpl=fetch,registeredAgents=[]}){
  let webPublicKey,webKeyAt=0,wazuhOffset=0;
  for(const row of registeredAgents)store.db.prepare('INSERT INTO server_registry VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET agent=excluded.agent,enabled=1').run(row.serverId,row.agentId);
  function validateRequest(x){
    if(!exact(x,requestKeys)||!uuid(x.requestId)||!/^[a-f0-9]{64}$/.test(x.contextDigest)||x.policyVersion!==policy.version||!uuid(x.subjectId)
      ||typeof x.sessionId!=='string'||x.sessionId.length>80||!uuid(x.deviceCredentialId)||!/^\/api\/(?:notes|my\/notes|announcements|restore)(?:\/[a-f0-9-]{36})?$/.test(x.resource)
      ||!['GET','POST','PUT','DELETE'].includes(x.operation)||!exact(x.counts,['recentRequests','recentBytes','webInputCount'])||Object.values(x.counts).some(n=>!Number.isSafeInteger(n)||n<0||n>1e9)
      ||!exact(x.signals,['sql','script','traversal','command','knownCve'])||Object.values(x.signals).some(v=>typeof v!=='boolean')||!Array.isArray(x.evidenceIds)||x.evidenceIds.length>16||!x.evidenceIds.every(uuid))throw fault('INVALID_ASSESSMENT_REQUEST',400);
  }
  async function evaluate(x){
    validateRequest(x);
    const recent=store.db.prepare("SELECT id,data FROM events WHERE source='wazuh' AND at>? AND id NOT IN (SELECT id FROM acknowledged_observations) ORDER BY at DESC LIMIT 16").all(Date.now()-policy.restrictionMs);
    const evidenceIds=[...x.evidenceIds],reasons=[];
    let riskLevel='low',recommendedControl='none';
    if(x.signals.knownCve){riskLevel='high';recommendedControl='deny';reasons.push('KNOWN_CVE_REQUEST');}
    if(Object.values(x.signals).some(Boolean)&&x.counts.webInputCount>=policy.webInputRepeatLimit){riskLevel='high';recommendedControl='deny';reasons.push('WEB_INPUT_ATTACK');}
    if(x.counts.recentBytes>=policy.maxWindowBytes){riskLevel='high';recommendedControl='deny';reasons.push('UNUSUAL_BULK_READ');}
    if(recent.some(e=>JSON.parse(e.data).level>=policy.integrityLevel)){riskLevel='high';recommendedControl='deny';reasons.push('SERVER_INTEGRITY_ALERT');evidenceIds.push(...recent.map(e=>e.id));}
    if((policy.aiRequired||policy.aiForAmbiguousInput&&Object.values(x.signals).some(Boolean))&&recommendedControl!=='deny'){
      try{
        if(!ai)throw Error('missing');
        const safe={counts:x.counts,signals:x.signals,evidenceIds:[...new Set(evidenceIds)].slice(0,16)};
        const r=await ai(safe);
        if(!exact(r,['riskLevel','recommendedControl','reasonCodes','evidenceIds'])||!['low','medium','high','unknown'].includes(r.riskLevel)||!controls.includes(r.recommendedControl)
          ||!Array.isArray(r.reasonCodes)||!r.reasonCodes.length||!r.reasonCodes.every(s=>reasonCodes.includes(s))||!Array.isArray(r.evidenceIds)||r.evidenceIds.some(id=>!safe.evidenceIds.includes(id)))throw Error('invalid');
        riskLevel=r.riskLevel;recommendedControl=r.recommendedControl;reasons.push(...r.reasonCodes);
      }catch{riskLevel='unknown';recommendedControl='deny';reasons.push('AI_REQUIRED_UNAVAILABLE');}
    }
    const at=Date.now();
    const result={schema:'keshev.risk.assessment.v1',assessmentId:randomUUID(),requestId:x.requestId,contextDigest:x.contextDigest,policyVersion:policy.version,
      riskLevel,recommendedControl,reasonCodes:reasons.length?[...new Set(reasons)]:['NORMAL_REQUEST'],evidenceIds:[...new Set(evidenceIds)].slice(0,16),
      evaluatedAt:new Date(at).toISOString(),validUntil:new Date(at+policy.assessmentTtlMs).toISOString()};
    store.event('server-b',{...x,signals:undefined,kind:'assessment',assessment:result});return result;
  }
  async function ingest(data){
    if(!exact(data,['eventId','requestId','subjectId','sessionId','deviceCredentialId','resource','kind','status','bytes','reasonCode','contextDigest','webEvent'])||!uuid(data.eventId)||!uuid(data.requestId)
      ||data.subjectId!==null&&!uuid(data.subjectId)||data.sessionId!==null&&(typeof data.sessionId!=='string'||data.sessionId.length>80)
      ||data.deviceCredentialId!==null&&!uuid(data.deviceCredentialId)||typeof data.resource!=='string'||data.resource.length>100
      ||!['access-decision','access-result','recovery-request'].includes(data.kind)||!Number.isSafeInteger(data.status)||data.status<100||data.status>599
      ||!Number.isSafeInteger(data.bytes)||data.bytes<0||data.bytes>policy.maxResponseBytes||typeof data.reasonCode!=='string'||!/^[A-Z0-9_]{1,80}$/.test(data.reasonCode)||!/^[a-f0-9]{64}$/.test(data.contextDigest))throw fault('INVALID_EVENT',400);
    const previous=store.db.prepare('SELECT data FROM events WHERE id=?').get(data.eventId);
    if(previous){if(previous.data!==JSON.stringify(data))throw fault('EVENT_CONFLICT',409);return;}
    let web;
    if(data.webEvent!==null){
      if(!webPublicKey||Date.now()-webKeyAt>300000){
        const r=await fetchImpl(webOrigin+'/api/security-key',{redirect:'error',signal:AbortSignal.timeout(4000)});
        if(!r.ok)throw fault('WEB_EVENT_KEY_UNAVAILABLE');const d=(await readJson(r)).data;
        if(d.schema!=='keshev.web-key.v1'||typeof d.publicKey!=='string')throw fault('WEB_EVENT_KEY_UNAVAILABLE');webPublicKey=d.publicKey;webKeyAt=Date.now();
      }
    }
    store.db.exec('BEGIN IMMEDIATE');
    try{
    if(data.webEvent!==null){
      web=unpack(webPublicKey,'web-event',data.webEvent,store.consume,Date.now(),policy.auditReplayWindowMs);
      if(web.schema!=='keshev.web.event.v1'||web.requestId!==data.requestId||web.contextDigest!==data.contextDigest||web.subjectId!==data.subjectId||web.status!==data.status
        ||!uuid(web.eventId)||!Number.isSafeInteger(web.bytes)||web.bytes!==data.bytes||!/^[a-f0-9]{64}$/.test(web.responseDigest??'')||!Number.isSafeInteger(web.records)||web.records<0||web.records>policy.maxRecords||!Number.isFinite(Date.parse(web.observedAt))||Date.now()-Date.parse(web.observedAt)>policy.auditReplayWindowMs||Date.parse(web.observedAt)>Date.now()+30000)throw fault('WEB_EVENT_REJECTED',403);
    }
    store.event('server-a',data);
    if(web)store.event('web-api',{...web,kind:'web-result',sessionId:data.sessionId,deviceCredentialId:data.deviceCredentialId,resource:data.resource});
    store.db.exec('COMMIT');
    }catch(e){store.db.exec('ROLLBACK');throw e;}
  }
  function readWazuh(path){
    try{
      const stat=statSync(path);if(stat.size<wazuhOffset)wazuhOffset=0;
      const start=Math.max(wazuhOffset,stat.size-1000000),length=stat.size-start;
      if(!length)return;
      const bytes=Buffer.alloc(length),fd=openSync(path,'r');try{readSync(fd,bytes,0,length,start);}finally{closeSync(fd);}
      const text=bytes.toString('utf8'),last=text.lastIndexOf('\n');if(last<0)return;
      const rows=text.slice(0,last).split('\n');if(start>wazuhOffset)rows.shift();
      for(const line of rows){
        let e;try{e=JSON.parse(line);}catch{continue;}
        const reg=store.db.prepare('SELECT id FROM server_registry WHERE agent=? AND enabled=1').get(String(e.agent?.id??''));if(!reg)continue;
        const at=Date.parse(e.timestamp),rid=String(e.rule?.id??''),level=e.rule?.level;
        if(!Number.isFinite(at)||Math.abs(Date.now()-at)>300000||!/^\d{1,10}$/.test(rid)||!Number.isSafeInteger(level)||level<0||level>16)continue;
        const groups=Array.isArray(e.rule.groups)?e.rule.groups.filter(g=>typeof g==='string'&&/^[a-z0-9_-]{1,60}$/i.test(g)).slice(0,16):[];
        if(store.db.prepare('SELECT 1 FROM events WHERE source=? AND request_id=?').get('wazuh',String(e.id)))continue;
        store.event('wazuh',{eventId:randomUUID(),requestId:String(e.id).slice(0,80),kind:'server-observation',serverId:reg.id,ruleId:rid,level,groups,
          fileHash:typeof e.syscheck?.path==='string'?sha(e.syscheck.path):null,observedAt:new Date(at).toISOString()});
      }
      wazuhOffset=start+Buffer.byteLength(text.slice(0,last+1));
    }catch{/* A health check reports missing observations; never synthesize a healthy server. */}
  }
  const server=createServer(async(req,res)=>{
    try{
      if(req.method==='GET'&&req.url==='/health'){send(res,200,{role:'server-b',policyVersion:policy.version,aiConfigured:Boolean(ai),registeredServers:store.db.prepare('SELECT count(*) n FROM server_registry WHERE enabled=1').get().n,
        serverEvents:store.db.prepare("SELECT count(*) n FROM events WHERE source='wazuh'").get().n});return;}
      if(req.method!=='POST'||!['/internal/evaluate','/internal/events'].includes(req.url))throw fault('NOT_FOUND',404);
      const x=unpack(aPublicKey,req.url,await jsonBody(req),store.consume);
      const result=req.url==='/internal/evaluate'?await evaluate(x):(await ingest(x),{accepted:true,eventId:x.eventId});
      send(res,200,packet(privateKey,req.url,result));
    }catch(e){send(res,e.status??503,{error:e.code??'ASSESSMENT_UNAVAILABLE'});}
  });
  server.requestTimeout=15000;server.headersTimeout=15000;
  return {server,evaluate,ingest,readWazuh};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const config=loadConfig(process.env.KESHEV_CONFIG??'/config/runtime.json'),policy=loadConfig('/app/server-security/policy.local.json');
  const store=openStore('/state/server-b.sqlite'),privateKey=readFileSync('/state/private.pem','utf8'),aPublicKey=config.aPublicKey;
  let ai;
  if(config.aiUrl)ai=async input=>{
    const r=await fetch(config.aiUrl,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(packet(privateKey,'risk-ai',input)),signal:AbortSignal.timeout(policy.assessmentTimeoutMs)});
    if(!r.ok)throw fault('AI_UNAVAILABLE');return (await readJson(r)).data;
  };
  const app=createAssessmentServer({store,privateKey,aPublicKey,policy,webOrigin:config.webOrigin,ai,registeredAgents:config.registeredAgents??[]});
  app.server.listen(8091,config.bIp);
  const timer=setInterval(()=>app.readWazuh('/wazuh/alerts.json'),1000);timer.unref();
  const backup=setInterval(()=>{try{saveBackup(store,privateKey);}catch{}},30000);backup.unref();
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);clearInterval(backup);app.server.close(()=>store.close());app.server.closeAllConnections();});
}
