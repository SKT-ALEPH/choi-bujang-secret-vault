import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const directory=resolve('.local/server-redesign/runtime'),config=JSON.parse(readFileSync(directory+'/config/runtime.json'));
const compose=['compose','--env-file',directory+'/compose.env','-f','server-security/compose.yaml'];
function inside(service,code){
  const r=spawnSync('docker',[...compose,'exec','-T',service,'node','--input-type=module','-e',code],{encoding:'utf8',timeout:25000});
  if(r.status!==0)throw Error('CONTAINER_CHECK_FAILED:'+service);return JSON.parse(r.stdout.trim());
}
const report={schema:'keshev.local.validation.v1',checkedAt:new Date().toISOString(),localHostIsolation:false,syntheticAssessmentIdentity:true,checks:[]};
function record(name,passed,details={}){report.checks.push({name,passed,...details});console.log(JSON.stringify({name,passed,...details}));writeFileSync(directory+'/verification.json',JSON.stringify(report,null,2));if(!passed)throw Error('CHECK_FAILED:'+name);}
const actor=inside('accessor',`const c=JSON.parse((await import('node:fs')).readFileSync('/config/runtime.json'));const r=await fetch('http://'+c.aIp+':8080/health',{signal:AbortSignal.timeout(5000)});console.log(JSON.stringify({status:r.status,data:await r.json()}));`);
record('NetBird accessor to A',actor.status===200&&actor.data.role==='server-a');
const b=inside('server-a',`const c=JSON.parse((await import('node:fs')).readFileSync('/config/runtime.json'));const r=await fetch('http://'+c.bIp+':8091/health',{signal:AbortSignal.timeout(5000)});console.log(JSON.stringify({status:r.status,data:await r.json()}));`);
record('NetBird A to B',b.status===200&&b.data.role==='server-b',{registeredCompanyServers:b.data.registeredServers,serverEvents:b.data.serverEvents});
const denied=inside('accessor',`const c=JSON.parse((await import('node:fs')).readFileSync('/config/runtime.json'));try{await fetch('http://'+c.bIp+':8091/health',{signal:AbortSignal.timeout(1500)});console.log(JSON.stringify({denied:false}));}catch{console.log(JSON.stringify({denied:true}));}`);
record('NetBird accessor to B denied',denied.denied);
const evaluateCode=signals=>`import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {packet,unpack,sha,checkAssessment} from './server-security/common.mjs';const c=JSON.parse(readFileSync('/config/runtime.json')),p=JSON.parse(readFileSync('server-security/policy.local.json'));const x={requestId:randomUUID(),contextDigest:sha('synthetic-local-validation'),policyVersion:p.version,subjectId:randomUUID(),sessionId:randomUUID(),deviceCredentialId:randomUUID(),resource:'/api/my/notes',operation:'GET',counts:{recentRequests:1,recentBytes:0,webInputCount:${signals?'1':'0'}},signals:{sql:${signals},script:false,traversal:false,command:false,knownCve:false},evidenceIds:[]};const r=await fetch('http://'+c.bIp+':8091/internal/evaluate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(packet(readFileSync('/state/private.pem','utf8'),'/internal/evaluate',x)),signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error('ASSESSMENT_HTTP_FAILED');const a=checkAssessment(unpack(c.bPublicKey,'/internal/evaluate',await r.json(),()=>{}),x,p);console.log(JSON.stringify({valid:true,risk:a.riskLevel,control:a.recommendedControl,reasons:a.reasonCodes}));`;
const normal=inside('server-a',evaluateCode(false));record('B response returns to A and validates',normal.valid,{risk:normal.risk,control:normal.control,reasons:normal.reasons});
if(process.argv.includes('--ai')){
  const before=await(await fetch('http://127.0.0.1:5297/health')).json();
  if(before.remaining!==1)throw Error('AI_ONE_CALL_LIMIT_ALREADY_USED');
  const answer=inside('server-a',evaluateCode(true));
  const after=await(await fetch('http://127.0.0.1:5297/health')).json();
  record('OAuth one real synthetic risk evaluation',after.remaining===0&&!answer.reasons.includes('AI_REQUIRED_UNAVAILABLE'),{risk:answer.risk,control:answer.control,reasons:answer.reasons,realInference:true,source:'numeric synthetic fixture; no note, credential, name, email or IP'});
}
if(process.argv.includes('--fim')){
  const target='/app/server-security/README.md',started=Date.now();
  const alter=`const f=await import('node:fs');const p=${JSON.stringify(target)},bytes=f.readFileSync(p);f.writeFileSync('/state/canary-original',bytes,{mode:0o600});f.appendFileSync(p,'\nLocal verification canary change.\n');console.log(JSON.stringify({modified:true}));`;
  inside('server-a',alter);
  const observations=()=>inside('server-b',`import {DatabaseSync} from 'node:sqlite';import {sha} from './server-security/common.mjs';const d=new DatabaseSync('/state/server-b.sqlite',{readOnly:true});console.log(JSON.stringify(d.prepare("SELECT id,data FROM events WHERE source='wazuh' AND at>? ORDER BY at").all(${started}).filter(e=>JSON.parse(e.data).fileHash===sha(${JSON.stringify(target)})).map(e=>({id:e.id,level:JSON.parse(e.data).level}))));`);
  let seen=[];
  try{
    for(let i=0;i<45;i++){seen=observations();if(seen.some(e=>e.level>=7))break;await new Promise(r=>setTimeout(r,1000));}
    record('Real Wazuh company-server FIM reaches B',seen.some(e=>e.level>=7),{events:seen.length});
    const blocked=inside('server-a',evaluateCode(false));record('Real FIM changes B risk to deny',blocked.control==='deny'&&blocked.reasons.includes('SERVER_INTEGRITY_ALERT'));
  }finally{inside('server-a',`const f=await import('node:fs');f.copyFileSync('/state/canary-original',${JSON.stringify(target)});f.unlinkSync('/state/canary-original');console.log(JSON.stringify({restored:true}));`);}
  await new Promise(r=>setTimeout(r,4000));
  for(const e of observations())inside('server-b',`import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync('/state/server-b.sqlite');d.prepare('INSERT INTO acknowledged_observations VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(${JSON.stringify(e.id)},Date.now());d.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)').run((await import('node:crypto')).randomUUID(),'local-operator',null,null,null,null,null,Date.now(),JSON.stringify({kind:'controlled-canary-restored-and-reviewed',evidenceIds:[${JSON.stringify(e.id)}]}));console.log(JSON.stringify({reviewed:true}));`);
  const recovered=inside('server-a',evaluateCode(false));record('Reviewed canary recovery preserves history and restores risk evaluation',recovered.control==='none',{risk:recovered.risk,reasons:recovered.reasons});
}
console.log(JSON.stringify({verified:report.checks.length,existingSupabaseAccountFlowVerified:false}));
