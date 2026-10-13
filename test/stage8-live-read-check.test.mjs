import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import vm from 'node:vm';

test('live check requires distinct logged-in A/B, rejects inconclusive/exposed reads and cleans only its fixtures',async()=>{
  const source=(await readFile(new URL('../scripts/stage8-live-read-check.mjs',import.meta.url),'utf8'))
    .replace(/^import .*;\n/gm,'').replace('export async function','async function');
  for(const logicalPaths of [false,true]) for(const bStatus of [404,401,200]){
    let memo,clients=0,written,deletedMemo=false;
    const deletedUsers=[],requests=[];
    const tokenA='ephemeral-a',tokenB='ephemeral-b',commit='a'.repeat(40);
    const admin={auth:{admin:{
      createUser:async()=>({data:{user:{id:'user-'+clients}},error:null}),
      deleteUser:async id=>{deletedUsers.push(id);return{error:null};},
      getUserById:async()=>({data:{user:null},error:{status:404}}),
    }},from(table){
      assert.equal(table,'notes');
      const filters={};let deletion=false;
      const query={delete(){deletion=true;return query;},select(){return query;},eq(k,v){filters[k]=v;return query;},
        maybeSingle:async()=>({data:memo,error:null}),
        then(resolve){assert.equal(filters.id,memo?.id??requests.find(r=>r.method==='POST').id);
          assert.equal(filters.owner_id,'user-1');if(deletion){memo=null;deletedMemo=true;}resolve({error:null});}};
      return query;
    }};
    const context=vm.createContext({randomUUID,randomBytes,createHash,URL,AbortSignal,
      process:{env:{SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'test-server-value',VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}},
      console:{log(){}},writeFile:async(_path,content)=>{written=content;},
      createClient(){clients++;return clients===1?admin:{auth:{signInWithPassword:async()=>({data:{session:{access_token:clients===2?tokenA:tokenB}},error:null})}};},
      fetch:async(target,options={})=>{
        const url=new URL(target),path=url.pathname,method=options.method??'GET';
        if(path==='/aleph.json')return{ok:true,json:async()=>({commit,repoUrl:'https://github.com/owner/repo'})};
        const owner=options.headers.Authorization==='Bearer '+tokenA;
        requests.push({path,method,owner,id:options.body?JSON.parse(options.body).id:null});
        let status=200,data;
        if(method==='POST'){memo={...JSON.parse(options.body)};status=201;data={id:memo.id};}
        else if(url.searchParams.has('action')){status=400;data={error:'RESOURCE_QUERY_NOT_ALLOWED'};}
        else if(method==='PUT' && Object.hasOwn(JSON.parse(options.body),'owner_id')){status=400;data={error:'OWNER_IMMUTABLE'};}
        else if(method==='DELETE' && owner){memo=null;data={deleted:true};}
        else if(['/api/notes','/notes'].includes(path) && !url.searchParams.has('id'))data=[];
        else if(!memo){status=404;data={error:'NOTE_NOT_FOUND'};}
        else if(owner){if(method==='PUT')Object.assign(memo,JSON.parse(options.body));data={...memo};}
        else {status=bStatus;data=status===200?memo:{error:status===404?'NOTE_NOT_FOUND':'INVALID_LOGIN'};}
        return{status,headers:{get:()=> 'safe-request-trace'},json:async()=>data};
      },
    });
    const runLiveReadCheck=await vm.runInContext('(async()=>{'+source.replaceAll('import.meta.url',JSON.stringify(import.meta.url))+';return runLiveReadCheck;})()',context);
    const promise=runLiveReadCheck({identityProvider:{issuer:'https://project.supabase.co/auth/v1'},publicAppUrl:'https://app.example',repoUrl:'https://github.com/Owner/Repo'},{logicalPaths});
    if(bStatus===404)await promise;else await assert.rejects(promise,/READ_CHECK_NOT_PASSED/);
    const proof=JSON.parse(written);
    assert.equal(proof.result,bStatus===404?'A_ALLOWED_B_DENIED':bStatus===200?'OTHER_USER_NOTE_EXPOSED':'INCONCLUSIVE');
    assert.equal(proof.testedCommit,commit);assert.notEqual(proof.buildCommit,proof.testedCommit);
    assert.equal(proof.cleanupOk,true);assert.equal(deletedMemo,true);
    if(bStatus===404)assert.ok(proof.checks.length===10 && proof.checks.every(c=>c.passed));
    assert.deepEqual(deletedUsers,['user-1','user-2']);
    assert.equal(proof.pathMode,logicalPaths?'logical':'api');
    const collection=logicalPaths?'/notes':'/api/notes';
    assert.ok(requests.every(r=>r.path===collection||r.path.startsWith(collection+'/')));
    const reads=requests.filter(r=>r.method==='GET'&&r.path!==collection);
    assert.equal(reads[0].path,reads[1].path);assert.equal(reads[0].owner,true);assert.equal(reads[1].owner,false);
    for(const privateValue of [tokenA,tokenB,'test-server-value','Synthetic verification content','Temporary access verification'])assert.ok(!written.includes(privateValue));
  }
});
