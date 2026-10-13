import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';

// Only new disposable B notes are changed. Their private backup/audit history is retained.
export async function runRecoveryCheck(config) {
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!url||!secret||url!==new URL(config.identityProvider.issuer).origin)throw Error('RECOVERY_CHECK_CONFIG_MISSING');
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(target,init)=>fetch(target,{...init,redirect:'error',signal:AbortSignal.timeout(20000)})}};
  const admin=createClient(url,secret,options),users=[],notes=[];
  const proof={kind:'live_b_note_recovery',at:new Date().toISOString(),buildCommit:process.env.VERCEL_GIT_COMMIT_SHA,checks:[],result:'INCONCLUSIVE'};
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const call=async(session,path,method='GET',body)=>{
    const r=await fetch(new URL(path,config.publicAppUrl),{method,redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},
      body:body===undefined?undefined:JSON.stringify(body)});
    return{status:r.status,data:await r.json().catch(()=>null)};
  };
  const check=(name,r,status,extra=true)=>proof.checks.push({name,status:r.status,expected:status,passed:r.status===status&&extra,
    ...(/^[A-Z_]+$/.test(r.data?.error??'')?{errorCode:r.data.error}:{})});
  const commit=async()=>{
    const r=await fetch(new URL('/aleph.json',config.publicAppUrl),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    const j=await r.json();if(!r.ok||j.step!==10||j.repoUrl?.toLowerCase()!==config.repoUrl.toLowerCase()||!/^[a-f0-9]{40}$/.test(j.commit))throw Error('RECOVERY_CHECK_DEPLOYMENT_UNKNOWN');return j.commit;
  };
  try {
    proof.testedCommit=await commit();
    const sessions=[];
    for(const label of ['b','a']) {
      const email='aleph-recovery-'+label+'-'+randomUUID()+'@example.com',password=randomBytes(32).toString('base64url')+'Aa1!';
      const made=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'disposable-stage10-recovery'}});
      if(made.error||!made.data.user)throw Error('RECOVERY_CHECK_CREATE_USER_FAILED');users.push(made.data.user.id);
      const client=createClient(url,secret,options),login=await client.auth.signInWithPassword({email,password});
      if(login.error||!login.data.session)throw Error('RECOVERY_CHECK_LOGIN_FAILED');sessions.push(login.data.session);
    }
    if(users[0]===users[1])throw Error('RECOVERY_CHECK_IDENTITIES_NOT_DISTINCT');
    const [b,a]=sessions,original='Synthetic original B recovery content',other='Synthetic other B content';
    for(const body of [original,other]) {
      const id=randomUUID();notes.push(id);
      const created=await call(b,'/api/notes','POST',{id,title:'Temporary B recovery',body});
      if(created.status!==201||created.data?.id!==id)throw Error('RECOVERY_CHECK_CREATE_NOTE_FAILED');
    }
    const id=notes[0],path='/api/notes/'+id,restore=config.restoreRoute.replace(':noteId',id);
    proof.resourceFingerprint=hash(id);
    check('anonymous_restore_denied',await call(null,restore,'POST',{}),401);
    check('foreign_restore_denied',await call(a,restore,'POST',{}),404);
    check('b_change_allowed',await call(b,path,'PUT',{title:'Changed synthetic B note',body:'Synthetic changed content'}),200);
    const modified=await call(b,restore,'POST',{});
    check('modified_note_restore_allowed',modified,200,modified.data?.restored===true&&modified.data.contentHash===hash(original)&&Object.values(modified.data.verified??{}).length===4&&Object.values(modified.data.verified).every(v=>v===true));
    const readModified=await call(b,path);
    check('modified_note_id_and_hash_match',readModified,200,readModified.data?.id===id&&hash(readModified.data.body??'')===hash(original));
    const otherAfter=await call(b,'/api/notes/'+notes[1]);
    check('other_note_preserved',otherAfter,200,otherAfter.data?.body===other);
    check('b_delete_allowed',await call(b,path,'DELETE'),200);
    check('deleted_note_absent',await call(b,path),404);
    const deleted=await call(b,restore,'POST',{});
    check('deleted_note_restore_allowed',deleted,200,deleted.data?.restored===true&&deleted.data.contentHash===hash(original));
    const readDeleted=await call(b,path);
    check('deleted_note_id_and_hash_match',readDeleted,200,readDeleted.data?.id===id&&hash(readDeleted.data.body??'')===hash(original));
    check('restored_note_foreign_read_denied',await call(a,path),404);
    check('restored_note_foreign_restore_denied',await call(a,restore,'POST',{}),404);
    proof.checks.push({name:'audit_append_confirmed',passed:Number(deleted.data?.auditId)>Number(modified.data?.auditId)});
    check('body_owner_forgery_denied',await call(b,restore,'POST',{owner_id:users[1]}),400);
    check('function_query_denied',await call(b,restore+'?action=all','POST',{}),400);
    check('restore_get_denied',await call(b,restore),405);
    const settings=JSON.parse(await readFile(new URL('../config/supabase-public.json',import.meta.url),'utf8'));
    const direct=await fetch(new URL('/rest/v1/rpc/restore_aleph_note',url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{apikey:settings.publishableKey,Authorization:'Bearer '+b.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({p_actor:users[0],p_note:id,p_policy_hash:'0'.repeat(64)})});
    proof.checks.push({name:'browser_direct_rpc_denied',status:direct.status,passed:direct.status===403});
    proof.deploymentUnchanged=proof.testedCommit===await commit();
    proof.result=proof.deploymentUnchanged&&proof.checks.length===17&&proof.checks.every(c=>c.passed)?'ALL_CHECKS_PASSED':'CHECK_FAILED';
  } catch(error) {proof.failure=/^RECOVERY_CHECK_[A-Z_]+$/.test(error.message)?error.message:'RECOVERY_CHECK_REQUEST_FAILED';}
  finally {
    proof.cleanupOk=true;
    if(users[0]&&notes.length) {
      try {
        const removed=await admin.from('notes').delete().in('id',notes).eq('owner_id',users[0]);
        const after=await admin.from('notes').select('id').in('id',notes).eq('owner_id',users[0]);
        if(removed.error||after.error||after.data?.length)proof.cleanupOk=false;
      } catch {proof.cleanupOk=false;}
    }
    for(const id of users) {
      try {const removed=await admin.auth.admin.deleteUser(id),after=await admin.auth.admin.getUserById(id);
        if(removed.error||after.data?.user||after.error?.status!==404)proof.cleanupOk=false;
      } catch {proof.cleanupOk=false;}
    }
    proof.createdAccounts=users.length;proof.activeTestNotesRemoved=proof.cleanupOk;
    proof.privateBackupAndAuditRetained=true;
    await writeFile(new URL('../public/stage10-recovery-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
    console.log('Stage10 recovery proof: '+JSON.stringify(proof));
  }
  if(proof.result!=='ALL_CHECKS_PASSED'||!proof.cleanupOk)throw Error('RECOVERY_CHECK_NOT_PASSED');
  return proof;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await runRecoveryCheck(JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8')));
}
