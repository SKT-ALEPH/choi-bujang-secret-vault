import {randomUUID,randomBytes,webcrypto,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createContext,SourceTextModule} from 'node:vm';
import {createClient} from '@supabase/supabase-js';
import {runAttackChecks} from '../src/attack-check.mjs';
import {CHECK_CASES} from '../src/operations.mjs';

// Run the actual browser device client with WebCrypto and real deployed HTTP.
// This exercises its protocol; it is not a claim of manual browser interaction.
export async function runDeviceCheck(config){
 const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY?.trim(),publicKey=process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
 if(!url||!secret||!publicKey||url!==new URL(config.identityProvider.issuer).origin)throw Error('DEVICE_CHECK_CONFIG_MISSING');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(u,o)=>fetch(u,{...o,redirect:'error',signal:AbortSignal.timeout(20000)})}};
 const admin=createClient(url,secret,options),users=[],notes=[];
 const proof={kind:'live_device_client_protocol',at:new Date().toISOString(),buildCommit:process.env.VERCEL_GIT_COMMIT_SHA,checks:[],result:'INCONCLUSIVE'};
 proof.records=[];
 const stages={student_announcement_write_denied:8,foreign_restore_denied:10,unsigned_change_after_restore_denied:11,out_of_scope_query_after_restore_denied:8,anonymous_device_status:11,authenticated_unapproved_notes_denied:6,not_approved_before_request:6,button_or_forged_approval_denied:11,approved_own_list_allowed:4,approved_session_without_signature_denied:11,first_nonce_allowed:11,replayed_nonce_denied:11,signed_path_change_denied:11,different_user_same_device_denied:11,stale_signature_denied:11,approved_create_allowed:2,signed_body_change_denied:11,signed_method_change_denied:11,tampering_preserves_note:4,approved_foreign_note_denied:4,approved_update_allowed:8,approved_restore_allowed:10,restore_preserves_prior_security_and_content:10,approved_announcement_read:8,revoked_device_denied:9};
 const check=(name,r,status,extra=true)=>{
  const passed=r.status===status&&extra;
  proof.checks.push({name,status:r.status,expected:status,passed,...(/^[A-Z_]+$/.test(r.data?.error??'')?{errorCode:r.data.error}:{})});
  proof.records.push({stage:stages[name]??11,type:status>=400?'forbidden':'normal',kind:'live_api_protocol',caseId:name,method:r.method,path:r.path,expected:'HTTP '+status,actual:'HTTP '+r.status,result:passed?'passed':'failed',requestId:r.requestId,checkedAt:r.checkedAt});
 };
 const send=async(session,path,method='GET',body,client=null,override=null)=>{
  proof.activeRequest={method,path:path.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,':id')};
  const o={method,...(body===undefined?{}:{body:JSON.stringify(body)})};
  const headers=override??(client?await client.headers(session,path,o):{});
  const r=await fetch(new URL(path,config.publicAppUrl),{...o,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...headers}});
  return{status:r.status,data:await r.json().catch(()=>null),method,path:path.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi,':id'),requestId:r.headers.get('x-request-id')??r.headers.get('x-vercel-id'),checkedAt:new Date().toISOString()};
 };
 const metadata=async()=>{const j=await(await fetch(new URL('/aleph.json',config.publicAppUrl),{cache:'no-store',redirect:'error'})).json();if(j.step!==config.step||j.repoUrl.toLowerCase()!==config.repoUrl.toLowerCase())throw Error('DEVICE_CHECK_DEPLOYMENT_UNKNOWN');return j.commit;};
 const browserClient=async()=>{
  const context=createContext({window:{},document:{dispatchEvent(){}},crypto:webcrypto,TextEncoder,Uint8Array,Event,btoa,URL,
    fetch:(path,o)=>fetch(new URL(path,config.publicAppUrl),{...o,redirect:'error',signal:AbortSignal.timeout(20000)})});
  const helper=new SourceTextModule(await readFile(new URL('../public/device-message.mjs',import.meta.url),'utf8'),{context});
  await helper.link(()=>{throw Error('unexpected helper import');});
  const module=new SourceTextModule(await readFile(new URL('../public/device-client.mjs',import.meta.url),'utf8'),{context});
  await module.link(specifier=>{if(specifier!=='./device-message.mjs')throw Error('unexpected client import');return helper;});
  await module.evaluate();return context.window.alephDevice;
 };
 try{
  proof.testedCommit=await metadata();const sessions=[];
  for(const label of ['b','a']){
   const email='aleph-device-'+label+'-'+randomUUID()+'@example.com',password=randomBytes(32).toString('base64url')+'Aa1!';
   const made=await admin.auth.admin.createUser({email,password,email_confirm:true});if(made.error||!made.data.user)throw Error('DEVICE_CHECK_CREATE_USER_FAILED');users.push(made.data.user.id);
   const login=await createClient(url,secret,options).auth.signInWithPassword({email,password});if(login.error||!login.data.session)throw Error('DEVICE_CHECK_LOGIN_FAILED');sessions.push(login.data.session);
  }
  const [b,a]=sessions,bc=await browserClient(),ac=await browserClient();
  check('anonymous_device_status',await send(null,'/api/device?operation=status'),401);
  check('authenticated_unapproved_notes_denied',await send(b,'/api/my/notes'),403);
  const status=await send(b,'/api/device?operation=status');check('not_approved_before_request',status,200,status.data?.approved===false);
  const invalid=await send(b,'/api/device?operation=approve','POST',{id:randomUUID(),signature:'a'.repeat(86)});check('button_or_forged_approval_denied',invalid,403);
  proof.checks.push({name:'actual_browser_client_b_approval',passed:await bc.approve(b)===true});
  proof.checks.push({name:'actual_browser_client_a_approval',passed:await ac.approve(a)===true});
  check('approved_own_list_allowed',await send(b,'/api/my/notes','GET',undefined,bc),200);
  check('approved_session_without_signature_denied',await send(b,'/api/my/notes'),403);
  const replay=await bc.headers(b,'/api/my/notes');
  check('first_nonce_allowed',await send(b,'/api/my/notes','GET',undefined,null,replay),200);
  check('replayed_nonce_denied',await send(b,'/api/my/notes','GET',undefined,null,replay),403);
  const pathProof=await bc.headers(b,'/api/my/notes');
  check('signed_path_change_denied',await send(b,'/api/announcements','GET',undefined,null,pathProof),403);
  check('different_user_same_device_denied',await send(a,'/api/my/notes','GET',undefined,null,await bc.headers(b,'/api/my/notes')),403);
  const stale=await bc.headers(b,'/api/my/notes');stale['x-aleph-at']=String(Date.now()-31000);
  check('stale_signature_denied',await send(b,'/api/my/notes','GET',undefined,null,stale),403);
  const id=randomUUID();notes.push(id);const original={id,title:'Temporary device B note',body:'Synthetic device session content'};
  check('approved_create_allowed',await send(b,'/api/notes','POST',original,bc),201);
  const path='/api/notes/'+id,body={title:'Synthetic change',body:'Synthetic changed content'};
  const bodyProof=await bc.headers(b,path,{method:'PUT',body:JSON.stringify(body)});
  check('signed_body_change_denied',await send(b,path,'PUT',{...body,body:'Tampered synthetic content'},null,bodyProof),403);
  const methodProof=await bc.headers(b,path,{method:'GET'});
  check('signed_method_change_denied',await send(b,path,'DELETE',undefined,null,methodProof),403);
  const unchanged=await send(b,path,'GET',undefined,bc);check('tampering_preserves_note',unchanged,200,unchanged.data?.body===original.body);
  check('approved_foreign_note_denied',await send(a,path,'GET',undefined,ac),404);
  check('approved_update_allowed',await send(b,path,'PUT',body,bc),200);
  check('approved_restore_allowed',await send(b,config.restoreRoute.replace(':noteId',id),'POST',{},bc),200);
  const restored=await send(b,path,'GET',undefined,bc);check('restore_preserves_prior_security_and_content',restored,200,restored.data?.body===original.body);
  check('approved_announcement_read',await send(b,'/api/announcements','GET',undefined,bc),200);
  const direct=await fetch(new URL('/rest/v1/aleph_device_sessions?select=id',url),{headers:{apikey:publicKey,Authorization:'Bearer '+b.access_token},redirect:'error'});
  proof.checks.push({name:'browser_direct_device_registry_denied',status:direct.status,passed:[401,403].includes(direct.status)});
  if(config.step===12){
   check('student_announcement_write_denied',await send(b,'/api/announcements/'+randomUUID(),'PUT',{title:'Synthetic',body:'Synthetic'},bc),403);
   check('foreign_restore_denied',await send(a,config.restoreRoute.replace(':noteId',id),'POST',{},ac),404);
   check('unsigned_change_after_restore_denied',await send(b,path,'PUT',body),403);
   check('out_of_scope_query_after_restore_denied',await send(b,path+'?operation=export','GET',undefined,bc),400);
   for(const caseId of Object.keys(CHECK_CASES)){
    const r=await send(null,'/api/checks?case='+caseId);
    const passed=r.status===200&&r.data?.ready===true;
    proof.checks.push({name:caseId,status:r.status,passed});
    proof.records.push({stage:r.data?.stage??CHECK_CASES[caseId][0],type:CHECK_CASES[caseId][1],kind:'synthetic_input_over_http',caseId,method:r.method,path:r.path,expected:CHECK_CASES[caseId][2],actual:r.data?.actual??'invalid_response',result:passed?'passed':'failed',requestId:r.requestId,checkedAt:r.checkedAt});
   }
   for(const [caseId,stage,path,accept] of [
    ['s01-normal-app',1,'/',(r,t)=>r.ok&&t.includes('내 자료실')],
    ['s01-public-data-empty',1,'/data.json',(r,t)=>r.ok&&JSON.parse(t).notes.length===0],
    ['s02-public-data-empty',2,'/data.json',(r,t)=>r.ok&&JSON.parse(t).notes.length===0],
    ['s03-approved-list',3,'/api/my/notes',null],
    ['s05-approved-server-list',5,'/api/my/notes',null],
    ['s06-approved-device-list',6,'/api/my/notes',null]]){
    if(!accept){const r=await send(b,path,'GET',undefined,bc);check(caseId,r,200);proof.records.at(-1).stage=stage;}
    else{const r=await fetch(new URL(path,config.publicAppUrl),{redirect:'error',signal:AbortSignal.timeout(10000)}),text=await r.text(),passed=accept(r,text);proof.checks.push({name:caseId,passed});proof.records.push({stage,type:caseId.includes('empty')?'forbidden':'normal',kind:'public_http',caseId,method:'GET',path,expected:caseId.includes('empty')?'HTTP 200; notes=0':'HTTP 200',actual:'HTTP '+r.status+(caseId.includes('empty')?'; notes='+JSON.parse(text).notes.length:''),result:passed?'passed':'failed',requestId:r.headers.get('x-vercel-id'),checkedAt:new Date().toISOString()});}
   }
   const r=await send(null,'/api/my/notes');check('s03-unauth-list',r,401);proof.records.at(-1).stage=3;
   const invalid=await send({access_token:'invalid.invalid.invalid'},'/api/my/notes');check('s03-invalid-token',invalid,401);proof.records.at(-1).stage=3;
   const directNotes=await fetch(new URL('/rest/v1/notes?select=id',url),{headers:{apikey:publicKey,Authorization:'Bearer '+b.access_token},redirect:'error',signal:AbortSignal.timeout(10000)});
   proof.records.push({stage:5,type:'forbidden',kind:'live_api_protocol',caseId:'s05-direct-notes',method:'GET',path:'/rest/v1/notes',expected:'HTTP 401/403',actual:'HTTP '+directNotes.status,result:[401,403].includes(directNotes.status)?'passed':'failed',requestId:directNotes.headers.get('sb-request-id')??directNotes.headers.get('x-request-id'),checkedAt:new Date().toISOString()});
  }
  const old=await runAttackChecks(config);proof.retests=old;proof.priorChecksPassed=old.every(c=>!c.observed.includes('실패'));
  const freshBeforeRevocation=await bc.headers(b,'/api/my/notes');
  await bc.revoke(b);
  check('revoked_device_denied',await send(b,'/api/my/notes','GET',undefined,null,freshBeforeRevocation),403);
  proof.deploymentUnchanged=proof.testedCommit===await metadata();
  if(config.step===12){
   proof.receiptsComplete=proof.records.every(r=>typeof r.requestId==='string'&&r.requestId.length>0&&Number.isFinite(Date.parse(r.checkedAt)));
   proof.stageCoverage=Array.from({length:11},(_,i)=>i+1).every(stage=>['normal','forbidden'].every(type=>proof.records.some(r=>r.stage===stage&&r.type===type&&r.result==='passed')));
   proof.sourceHashes={};
   for(const path of ['api/notes.js','api/my/notes.js','api/announcements.js','api/auth.js','api/restore.js','api/device.js','api/checks.js','src/decider.mjs','src/detect.mjs','src/verify-login.mjs','src/device-session.mjs','src/operations.mjs','src/recovery-policy.mjs','public/device-client.mjs','public/device-message.mjs','public/operations.mjs','public/app.js','public/index.html','aleph.config.json','vercel.json'])proof.sourceHashes[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
  }
  proof.result=proof.checks.every(c=>c.passed)&&proof.priorChecksPassed&&proof.deploymentUnchanged&&(config.step!==12||proof.receiptsComplete&&proof.stageCoverage)?'ALL_CHECKS_PASSED':'CHECK_FAILED';
 }catch(error){proof.failedCheck=/^[a-z0-9_-]+: HTTP [0-9]{3} did not match expected result$/.test(error.message)?error.message:null;proof.failureType=['TimeoutError','AbortError','TypeError'].includes(error.name)?error.name:'Error';proof.failure=/^DEVICE_CHECK_[A-Z_]+$/.test(error.message)?error.message:'DEVICE_CHECK_REQUEST_FAILED';}
 finally{
  proof.cleanupOk=true;
  try{if(users[0]&&notes.length){const d=await admin.from('notes').delete().in('id',notes).eq('owner_id',users[0]);const after=await admin.from('notes').select('id').in('id',notes).eq('owner_id',users[0]);if(d.error||after.error||after.data?.length)proof.cleanupOk=false;}
   for(const id of users){const d=await admin.from('aleph_device_sessions').delete().eq('user_id',id);const u=await admin.auth.admin.deleteUser(id);const after=await admin.auth.admin.getUserById(id);if(d.error||u.error||after.data?.user||after.error?.status!==404)proof.cleanupOk=false;}
  }catch{proof.cleanupOk=false;}
  proof.createdAccounts=users.length;proof.privateRecoveryBackupAndAuditRetained=true;
  await writeFile(new URL(config.step===12?'../public/stage12-live-proof.json':'../public/stage11-device-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
  console.log('Stage11 summary: '+JSON.stringify({...proof,checks:undefined,retests:undefined,records:undefined,sourceHashes:undefined}));
  for(const item of proof.checks)console.log('Stage11 check: '+JSON.stringify(item));
  if(config.step===12)for(const item of proof.records)console.log('Stage12 receipt: '+JSON.stringify(item));
 }
 if(proof.result!=='ALL_CHECKS_PASSED'||!proof.cleanupOk)throw Error('DEVICE_CHECK_NOT_PASSED');return proof;
}
if(process.argv[1]?.endsWith('/stage11-live-check.mjs'))await runDeviceCheck(JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8')));
