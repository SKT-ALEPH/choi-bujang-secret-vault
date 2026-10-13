import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SourceTextModule,createContext} from 'node:vm';
import {loadSafePolicy,SAFE_POLICY_HASH,initializeTestPolicy,previewTestPolicy,applyTestPolicy} from '../src/recovery-policy.mjs';
import {createRestoreHandler} from '../api/restore.js';
import {fixtureRequests} from '../scripts/fixture-7.mjs';

const id='00000000-0000-4000-8000-000000000001';
const owner='00000000-0000-4000-8000-000000000002';
const response=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;}});

test('restore rewrite uses the same id parameter as the server query contract',async()=>{
  const deployment=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(deployment.rewrites.find(r=>r.source.startsWith('/api/restore/')),
    {source:'/api/restore/:id',destination:'/api/restore?id=:id'});
});

test('verified policy preview binds the exact changes; restore preserves unrelated rules and old audit history',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aleph-policy-'));
  try {
    await initializeTestPolicy(directory);
    const safe=await loadSafePolicy();
    assert.equal(safe.policyHash,SAFE_POLICY_HASH);
    await writeFile(join(directory,'decider.mjs'),'export async function decide(){return {decision:"allow"};}');
    await writeFile(join(directory,'other-service.json'),'unrelated');
    await writeFile(join(directory,'audit.jsonl'),'old-audit\n');
    const preview=await previewTestPolicy(directory);
    assert.deepEqual(preview.changes.map(c=>c.file),['decider.mjs']);
    await assert.rejects(applyTestPolicy(directory,'incorrect'),/POLICY_PREVIEW_CHANGED/);
    assert.equal((await previewTestPolicy(directory)).confirmation,preview.confirmation);
    const result=await applyTestPolicy(directory,preview.confirmation);
    assert.equal(result.restored,1);assert.equal(result.changes.length,0);
    assert.equal(await readFile(join(directory,'other-service.json'),'utf8'),'unrelated');
    const audit=await readFile(join(directory,'audit.jsonl'),'utf8');
    assert.ok(audit.startsWith('old-audit\n'));assert.equal(JSON.parse(audit.split('\n')[1]).action,'test_policy_restore');
    const module=new SourceTextModule(await readFile(join(directory,'decider.mjs'),'utf8'),{context:createContext({})});
    await module.link(()=>{throw Error('unexpected import');});await module.evaluate({timeout:1000});
    const {normal}=fixtureRequests();
    assert.equal((await module.namespace.decide(normal)).decision,'allow');
    assert.equal((await module.namespace.decide({...normal,path:'/notes',route:'GET /notes'})).decision,'deny');
    assert.equal((await module.namespace.decide({...normal,service:'announcements',method:'PUT',path:'/announcements/demo',route:'PUT /announcements/:id'})).decision,'deny');
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('a current test-policy change after preview invalidates confirmation and cannot touch operational policy',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'aleph-policy-'));
  try {
    await initializeTestPolicy(directory);const before=await previewTestPolicy(directory);
    await writeFile(join(directory,'detect.mjs'),'changed');
    await assert.rejects(applyTestPolicy(directory,before.confirmation),/POLICY_PREVIEW_CHANGED/);
    assert.equal(await readFile(join(directory,'detect.mjs'),'utf8'),'changed');
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('restore authenticates first, binds the saved owner to verified identity and rejects authority or backup tampering',async()=>{
  let calls=0,mode='valid',policyValid=true;
  const handler=createRestoreHandler(()=>({verifyLoginAuthorization:async header=>header==='valid'?{userId:owner}:null,
    database:{rpc(name,args){calls++;assert.equal(name,'restore_aleph_note');assert.equal(args.p_actor,owner);assert.equal(args.p_note,id);assert.equal(args.p_policy_hash,SAFE_POLICY_HASH);
      return{abortSignal:async()=>({error:null,data:mode==='missing'?[]:[{note_id:id,owner_id:mode==='wrong-owner'?id:owner,content_sha256:'a'.repeat(64),policy_sha256:SAFE_POLICY_HASH,backup_version:1,verified:true,audit_id:1}]})};}}
  }),async()=>{if(!policyValid)throw Error('BACKUP_VERIFICATION_FAILED');return{policyHash:SAFE_POLICY_HASH,version:'safe-version'};});
  const call=async(fields={})=>{const res=response();await handler({method:'POST',headers:{authorization:'valid'},query:{id},...fields},res);return res;};
  assert.equal((await call({headers:{}})).statusCode,401);
  assert.equal((await call({headers:{authorization:'invalid'}})).statusCode,401);
  assert.equal((await call({method:'GET'})).statusCode,405);
  assert.equal((await call({body:{owner_id:owner}})).statusCode,400);
  assert.equal((await call({query:{id:id+'\n'}})).statusCode,400);
  assert.equal((await call({query:{id,action:'all'}})).statusCode,400);assert.equal(calls,0);
  policyValid=false;assert.equal((await call()).statusCode,409);assert.equal(calls,0);policyValid=true;
  mode='missing';assert.equal((await call()).statusCode,404);
  mode='wrong-owner';assert.equal((await call()).statusCode,409);
  mode='valid';const restored=await call();assert.equal(restored.statusCode,200);assert.equal(restored.body.id,id);
  assert.equal(Object.hasOwn(restored.body,'owner_id'),false);assert.equal(Object.hasOwn(restored.body,'content'),false);
});
