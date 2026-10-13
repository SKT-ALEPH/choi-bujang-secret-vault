import {randomUUID, randomBytes, createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';

export async function runLiveReadCheck(config) {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret || url !== new URL(config.identityProvider.issuer).origin) throw new Error('READ_CHECK_CONFIG_MISSING');
  const options = {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(target, init)=>fetch(target,{...init,redirect:'error',signal:AbortSignal.timeout(20000)})}};
  const admin = createClient(url, secret, options);
  const users = [];
  let ownSession, noteId, cleanupOk = true;
  const proof = {kind:'live_supabase_auth_and_deployed_api',at:new Date().toISOString(),
    buildCommit:process.env.VERCEL_GIT_COMMIT_SHA,result:'INCONCLUSIVE'};
  const deployedCommit = async()=>{
    const response=await fetch(new URL('/aleph.json',config.publicAppUrl),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const identity=await response.json();
    if(!response.ok || !/^[0-9a-f]{40}$/.test(identity.commit) || identity.repoUrl?.toLowerCase()!==config.repoUrl.toLowerCase())throw new Error('READ_CHECK_DEPLOYMENT_UNKNOWN');
    return identity.commit;
  };
  const call = async (session, path, method='GET', body) => {
    const response = await fetch(new URL(path, config.publicAppUrl), {method,redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    let data;try { data=await response.json(); } catch { data=null; }
    return {status:response.status,data,trace:response.headers.get('x-vercel-id')};
  };
  try {
    proof.testedCommit=await deployedCommit();
    const sessions=[];
    for(const label of ['a','b']) {
      const email='aleph-read-'+label+'-'+randomUUID()+'@example.com';
      const password=randomBytes(32).toString('base64url')+'Aa1!';
      const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'disposable-stage8-read-check'}});
      if(created.error || !created.data.user)throw new Error('READ_CHECK_CREATE_USER_FAILED');
      users.push(created.data.user.id);
      const client=createClient(url,secret,options);
      const login=await client.auth.signInWithPassword({email,password});
      if(login.error || !login.data.session)throw new Error('READ_CHECK_LOGIN_FAILED');
      sessions.push(login.data.session);
    }
    ownSession=sessions[0];
    if(users[0]===users[1])throw new Error('READ_CHECK_IDENTITIES_NOT_DISTINCT');
    noteId=randomUUID();
    const created=await call(ownSession,'/api/notes','POST',{id:noteId,title:'Temporary access verification',body:'Synthetic verification content'});
    if(created.status!==201 || created.data?.id!==noteId)throw new Error('READ_CHECK_CREATE_NOTE_FAILED');
    const path='/api/notes/'+noteId;
    const a=await call(ownSession,path);
    const b=await call(sessions[1],path);
    const bList=await call(sessions[1],'/api/notes');
    const returned=result=>result.data?.id===noteId && typeof result.data.body==='string';
    Object.assign(proof,{distinctAccounts:true,resourceFingerprint:createHash('sha256').update(noteId).digest('hex'),
      a:{status:a.status,noteReturned:returned(a),requestTrace:a.trace},
      b:{status:b.status,noteReturned:returned(b),errorCode:b.data?.error==='NOTE_NOT_FOUND'?'NOTE_NOT_FOUND':null,requestTrace:b.trace},
      bList:{status:bList.status,containsANote:Array.isArray(bList.data)?bList.data.some(row=>row.id===noteId):null},
      result:a.status===200 && returned(a) && b.status===404 && b.data?.error==='NOTE_NOT_FOUND' && !returned(b)
        && bList.status===200 && Array.isArray(bList.data) && !bList.data.some(row=>row.id===noteId)
        ?'A_ALLOWED_B_DENIED':b.status===200 && returned(b)?'OTHER_USER_NOTE_EXPOSED':'INCONCLUSIVE'});
    proof.deploymentUnchanged=proof.testedCommit===await deployedCommit();
    if(!proof.deploymentUnchanged)proof.result='INCONCLUSIVE';
  } catch(error) {
    proof.failure=/^READ_CHECK_[A-Z_]+$/.test(error.message)?error.message:'READ_CHECK_REQUEST_FAILED';
  } finally {
    if(noteId && ownSession) {
      try {
        await call(ownSession,'/api/notes/'+noteId,'DELETE');
        // Scope fallback cleanup to the random memo owned by this run's new A.
        const removed=await admin.from('notes').delete().eq('id',noteId).eq('owner_id',users[0]);
        const remaining=await admin.from('notes').select('id').eq('id',noteId).eq('owner_id',users[0]).maybeSingle();
        const after=await call(ownSession,'/api/notes/'+noteId);
        cleanupOk=!removed.error && !remaining.error && !remaining.data && after.status===404;
      } catch { cleanupOk=false; }
    }
    for(const userId of users) {
      try {
        const deleted=await admin.auth.admin.deleteUser(userId);
        const after=await admin.auth.admin.getUserById(userId);
        if(deleted.error || after.data?.user || after.error?.status!==404)cleanupOk=false;
      } catch {cleanupOk=false;}
    }
    proof.createdAccounts=users.length;
    proof.cleanupOk=cleanupOk;
    await writeFile(new URL('../public/stage8-live-read-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
    console.log('Stage8 live read proof: '+JSON.stringify(proof));
  }
  if(proof.result!=='A_ALLOWED_B_DENIED' || !cleanupOk)throw new Error('READ_CHECK_NOT_PASSED');
  return proof;
}

if(process.argv?.[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const config=JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8'));
  await runLiveReadCheck(config);
}
