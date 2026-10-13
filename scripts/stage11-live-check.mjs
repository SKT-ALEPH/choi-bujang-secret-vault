import {randomUUID,randomBytes,webcrypto} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createContext,SourceTextModule} from 'node:vm';
import {createClient} from '@supabase/supabase-js';
import {runAttackChecks} from '../src/attack-check.mjs';

// Run the actual browser device client with WebCrypto and real deployed HTTP.
// This exercises its protocol; it is not a claim of manual browser interaction.
export async function runDeviceCheck(config){
 const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY?.trim();
 if(!url||!secret||url!==new URL(config.identityProvider.issuer).origin)throw Error('DEVICE_CHECK_CONFIG_MISSING');
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(u,o)=>fetch(u,{...o,redirect:'error',signal:AbortSignal.timeout(20000)})}};
 const admin=createClient(url,secret,options),users=[],notes=[];
 const proof={kind:'live_device_client_protocol',at:new Date().toISOString(),buildCommit:process.env.VERCEL_GIT_COMMIT_SHA,checks:[],result:'INCONCLUSIVE'};
 const check=(name,r,status,extra=true)=>proof.checks.push({name,status:r.status,expected:status,passed:r.status===status&&extra,...(/^[A-Z_]+$/.test(r.data?.error??'')?{errorCode:r.data.error}:{})});
 const send=async(session,path,method='GET',body,client=null,override=null)=>{
  const o={method,...(body===undefined?{}:{body:JSON.stringify(body)})};
  const headers=override??(client?await client.headers(session,path,o):{});
  const r=await fetch(new URL(path,config.publicAppUrl),{...o,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...headers}});
  return{status:r.status,data:await r.json().catch(()=>null)};
 };
 const metadata=async()=>{const j=await(await fetch(new URL('/aleph.json',config.publicAppUrl),{cache:'no-store',redirect:'error'})).json();if(j.step!==11||j.repoUrl.toLowerCase()!==config.repoUrl.toLowerCase())throw Error('DEVICE_CHECK_DEPLOYMENT_UNKNOWN');return j.commit;};
 const browserClient=async()=>{
  const context=createContext({window:{},document:{dispatchEvent(){}},crypto:webcrypto,TextEncoder,Uint8Array,Event,btoa,
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
  const settings=JSON.parse(await readFile(new URL('../config/supabase-public.json',import.meta.url),'utf8'));
  const direct=await fetch(new URL('/rest/v1/aleph_device_sessions?select=id',url),{headers:{apikey:settings.publishableKey,Authorization:'Bearer '+b.access_token},redirect:'error'});
  proof.checks.push({name:'browser_direct_device_registry_denied',status:direct.status,passed:[401,403].includes(direct.status)});
  const old=await runAttackChecks(config);proof.retests=old;proof.priorChecksPassed=old.every(c=>!c.observed.includes('실패'));
  await bc.revoke(b);
  check('revoked_device_denied',await send(b,'/api/my/notes','GET',undefined,null,replay),403);
  proof.deploymentUnchanged=proof.testedCommit===await metadata();
  proof.result=proof.checks.every(c=>c.passed)&&proof.priorChecksPassed&&proof.deploymentUnchanged?'ALL_CHECKS_PASSED':'CHECK_FAILED';
 }catch(error){proof.failure=/^DEVICE_CHECK_[A-Z_]+$/.test(error.message)?error.message:'DEVICE_CHECK_REQUEST_FAILED';}
 finally{
  proof.cleanupOk=true;
  try{if(users[0]&&notes.length){const d=await admin.from('notes').delete().in('id',notes).eq('owner_id',users[0]);const after=await admin.from('notes').select('id').in('id',notes).eq('owner_id',users[0]);if(d.error||after.error||after.data?.length)proof.cleanupOk=false;}
   for(const id of users){const d=await admin.from('aleph_device_sessions').delete().eq('user_id',id);const u=await admin.auth.admin.deleteUser(id);const after=await admin.auth.admin.getUserById(id);if(d.error||u.error||after.data?.user||after.error?.status!==404)proof.cleanupOk=false;}
  }catch{proof.cleanupOk=false;}
  proof.createdAccounts=users.length;proof.privateRecoveryBackupAndAuditRetained=true;
  await writeFile(new URL('../public/stage11-device-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');console.log('Stage11 device proof: '+JSON.stringify(proof));
 }
 if(proof.result!=='ALL_CHECKS_PASSED'||!proof.cleanupOk)throw Error('DEVICE_CHECK_NOT_PASSED');return proof;
}
if(process.argv[1]?.endsWith('/stage11-live-check.mjs'))await runDeviceCheck(JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8')));
