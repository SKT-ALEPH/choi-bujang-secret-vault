import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';

// Disposable fixture rows are prepared and removed by the database owner.
export const FIXTURE={editor:'995edf6a-eb51-4c0a-86cf-74b0ac501c05',student:'815c3a42-75f8-4116-8227-d286c941216d',
  own:'0cd7921e-574e-4252-bd6d-dd27c7d9347e',other:'b6d33705-d394-48ba-a097-fce573c5b433'};

export async function runAnnouncementCheck(config,publicKey) {
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!url || !secret || !publicKey || url!==new URL(config.identityProvider.issuer).origin)throw Error('ANNOUNCEMENT_CHECK_CONFIG_MISSING');
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(target,init)=>fetch(target,{...init,redirect:'error',signal:AbortSignal.timeout(20000)})}};
  const admin=createClient(url,secret,options),users=[];
  const proof={kind:'live_supabase_auth_and_deployed_announcement_api',at:new Date().toISOString(),
    buildCommit:process.env.VERCEL_GIT_COMMIT_SHA,result:'INCONCLUSIVE',checks:[]};
  const commit=async()=>{
    const r=await fetch(new URL('/aleph.json',config.publicAppUrl),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const d=await r.json();
    if(!r.ok || !/^[a-f0-9]{40}$/.test(d.commit) || d.repoUrl?.toLowerCase()!==config.repoUrl.toLowerCase())throw Error('ANNOUNCEMENT_CHECK_DEPLOYMENT_UNKNOWN');
    return d.commit;
  };
  const call=async(session,path,method='GET',body,direct=false)=>{
    const r=await fetch(new URL(path,direct?url:config.publicAppUrl),{method,redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...(direct?{apikey:publicKey}:{})},
      body:body?JSON.stringify(body):undefined});
    let data;try{data=await r.json();}catch{data=null;}
    return {status:r.status,data,trace:r.headers.get('x-vercel-id')};
  };
  const check=(name,r,status,extra=true)=>proof.checks.push({name,status:r.status,expectedStatus:status,passed:r.status===status && extra,requestTrace:r.trace});
  const fixtureRow=async id=>{
    const r=await admin.from('announcements').select('id,title,content').eq('id',id).single();
    if(r.error || !r.data)throw Error('ANNOUNCEMENT_CHECK_FIXTURE_MISSING');return r.data;
  };
  try{
    proof.testedCommit=await commit();
    const initial=await fixtureRow(FIXTURE.own),otherInitial=await fixtureRow(FIXTURE.other);
    proof.resourceFingerprint=createHash('sha256').update(FIXTURE.own).digest('hex');
    const sessions={};
    for(const label of ['editor','student']){
      const email='aleph-announcement-'+randomUUID()+'@example.com',password=randomBytes(32).toString('base64url')+'Aa1!';
      const created=await admin.auth.admin.createUser({id:FIXTURE[label],email,password,email_confirm:true,user_metadata:{purpose:'disposable-announcement-check'}});
      if(created.error || !created.data.user)throw Error('ANNOUNCEMENT_CHECK_CREATE_USER_FAILED');
      users.push(created.data.user.id);
      if(created.data.user.id!==FIXTURE[label])throw Error('ANNOUNCEMENT_CHECK_ID_MISMATCH');
      const client=createClient(url,secret,options),login=await client.auth.signInWithPassword({email,password});
      if(login.error || login.data.session?.user.id!==FIXTURE[label])throw Error('ANNOUNCEMENT_CHECK_LOGIN_FAILED');
      sessions[label]=login.data.session;
    }
    const path='/api/announcements/'+FIXTURE.own,otherPath='/api/announcements/'+FIXTURE.other;
    const update={title:'Temporary updated announcement',body:'Synthetic updated content'};
    for(const [name,target,method,body] of [
      ['anonymous_list_denied','/api/announcements','GET'],
      ['anonymous_read_denied',path,'GET'],['anonymous_edit_denied',path,'PUT',update]]){
      const r=await call(null,target,method,body);
      check(name,r,401,r.data?.error==='LOGIN_REQUIRED' && !r.data.body && !Array.isArray(r.data));
    }
    const read=await call(sessions.student,path);
    check('member_read_allowed',read,200,read.data?.id===FIXTURE.own && read.data.body===initial.content);
    const list=await call(sessions.student,'/api/announcements');
    check('member_list_allowed',list,200,Array.isArray(list.data) && list.data.some(r=>r.id===FIXTURE.own));
    const denied=await call(sessions.student,path,'PUT',update);
    check('member_edit_denied',denied,403,denied.data?.error==='ANNOUNCEMENT_EDIT_DENIED');
    check('body_role_forgery_denied',await call(sessions.student,path,'PUT',{...update,role:'teacher'}),400);
    const afterDenial=await fixtureRow(FIXTURE.own);
    proof.checks.push({name:'unauthorized_attempts_preserved_content',passed:afterDenial.content===initial.content && afterDenial.title===initial.title});
    const edited=await call(sessions.editor,path,'PUT',update);
    check('stored_editor_edit_allowed',edited,200,edited.data?.id===FIXTURE.own && edited.data.body===update.body);
    const persisted=await call(sessions.student,path);
    check('authorized_edit_persisted',persisted,200,persisted.data?.body===update.body && persisted.data.title===update.title);
    const otherDenied=await call(sessions.editor,otherPath,'PUT',update);
    check('editor_other_resource_denied',otherDenied,403,otherDenied.data?.error==='ANNOUNCEMENT_EDIT_DENIED');
    const otherAfter=await fixtureRow(FIXTURE.other);
    proof.checks.push({name:'other_resource_preserved',passed:otherAfter.content===otherInitial.content && otherAfter.title===otherInitial.title});
    const directPath='/rest/v1/announcements?id=eq.'+FIXTURE.own;
    check('direct_database_read_denied',await call(sessions.student,directPath+'&select=id','GET',undefined,true),403);
    check('direct_database_edit_denied',await call(sessions.student,directPath,'PATCH',{content:'Synthetic forbidden direct edit'},true),403);
    check('direct_grant_table_denied',await call(sessions.student,'/rest/v1/announcement_editors?select=announcement_id','GET',undefined,true),403);
    check('direct_rpc_identity_forgery_denied',await call(sessions.student,'/rest/v1/rpc/edit_announcement','POST',
      {p_user:FIXTURE.editor,p_id:FIXTURE.own,p_title:update.title,p_content:'Synthetic forbidden RPC edit'},true),403);
    const final=await fixtureRow(FIXTURE.own);
    proof.checks.push({name:'direct_bypasses_preserved_content',passed:final.content===update.body && final.title===update.title});
    proof.deploymentUnchanged=proof.testedCommit===await commit();
    proof.result=proof.deploymentUnchanged && proof.checks.every(c=>c.passed)?'ALL_CHECKS_PASSED':'CHECK_FAILED';
  }catch(error){
    proof.failure=/^ANNOUNCEMENT_CHECK_[A-Z_]+$/.test(error.message)?error.message:'ANNOUNCEMENT_CHECK_REQUEST_FAILED';
  }finally{
    proof.accountsCleanupOk=true;
    for(const id of users){
      try{
        const removed=await admin.auth.admin.deleteUser(id),after=await admin.auth.admin.getUserById(id);
        if(removed.error || after.data?.user || after.error?.status!==404)proof.accountsCleanupOk=false;
      }catch{proof.accountsCleanupOk=false;}
    }
    proof.createdAccounts=users.length;
    proof.fixtureCleanup='database_owner_pending';
    await writeFile(new URL('../public/stage8-announcement-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
    console.log('Stage8 announcement proof: '+JSON.stringify(proof));
  }
  if(proof.result!=='ALL_CHECKS_PASSED' || !proof.accountsCleanupOk)throw Error('ANNOUNCEMENT_CHECK_NOT_PASSED');
  return proof;
}

if(process.argv?.[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const config=JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8'));
  const settings=JSON.parse(await readFile(new URL('../config/supabase-public.json',import.meta.url),'utf8'));
  await runAnnouncementCheck(config,settings.publishableKey);
}
