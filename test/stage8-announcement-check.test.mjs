import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import vm from 'node:vm';

test('announcement live check verifies real permission outcomes, detects unauthorized writes and cleans accounts without exposing data',async()=>{
  const source=(await readFile(new URL('../scripts/stage8-announcement-check.mjs',import.meta.url),'utf8'))
    .replace(/^import .*;\n/gm,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
  for(const unauthorizedStatus of [403,200]){
    let clients=0,created=0,written,fixture;
    const rows=new Map(),removed=[],tokenA='ephemeral-editor',tokenB='ephemeral-member';
    const admin={auth:{admin:{
      createUser:async({id})=>{assert.equal(id,created++===0?fixture.editor:fixture.student);return{data:{user:{id}},error:null};},
      deleteUser:async id=>{removed.push(id);return{error:null};},
      getUserById:async()=>({data:{user:null},error:{status:404}}),
    }},from(table){
      assert.equal(table,'announcements');let id;
      const q={select(){return q;},eq(k,v){assert.equal(k,'id');id=v;return q;},single:async()=>({data:{...rows.get(id)},error:null})};return q;
    }};
    const context=vm.createContext({randomUUID,randomBytes,createHash,URL,AbortSignal,
      process:{env:{SUPABASE_URL:'https://project.supabase.co',SUPABASE_SECRET_KEY:'test-server-value',VERCEL_GIT_COMMIT_SHA:'b'.repeat(40)}},
      console:{log(){}},writeFile:async(_path,content)=>{written=content;},
      createClient(){clients++;const editor=clients===2;return clients===1?admin:{auth:{signInWithPassword:async()=>({data:{session:{access_token:editor?tokenA:tokenB,user:{id:editor?fixture.editor:fixture.student}}},error:null})}};},
      fetch:async(target,init={})=>{
        const u=new URL(target),method=init.method??'GET';
        if(u.pathname==='/aleph.json')return{ok:true,json:async()=>({commit:'a'.repeat(40),repoUrl:'https://github.com/owner/repo'})};
        let status=200,data;const auth=init.headers?.Authorization,editor=auth==='Bearer '+tokenA;
        if(u.pathname.startsWith('/rest/')){assert.equal(init.headers.apikey,'test-public-value');status=403;data={code:'42501'};}
        else if(!auth){status=401;data={error:'LOGIN_REQUIRED'};}
        else if(u.pathname==='/api/announcements')data=[...rows.values()].map(r=>({id:r.id,title:r.title,body:r.content}));
        else{
          const id=u.pathname.split('/').at(-1),row=rows.get(id);
          if(method==='PUT'){
            const input=JSON.parse(init.body);
            if(input.role){status=400;data={error:'INVALID_RESOURCE_INPUT'};}
            else if(!editor || id!==fixture.own){status=editor?403:unauthorizedStatus;data={error:'ANNOUNCEMENT_EDIT_DENIED'};}
            if(status===200){row.title=input.title;row.content=input.body;data={id,title:row.title,body:row.content};}
          }else data={id,title:row.title,body:row.content};
        }
        return{status,headers:{get:()=> 'safe-request-trace'},json:async()=>data};
      },
    });
    const loaded=await vm.runInContext('(async()=>{'+source+';return {runAnnouncementCheck,FIXTURE};})()',context);
    fixture=loaded.FIXTURE;
    rows.set(fixture.own,{id:fixture.own,title:'Synthetic initial title',content:'Synthetic initial content'});
    rows.set(fixture.other,{id:fixture.other,title:'Synthetic separate title',content:'Synthetic separate content'});
    const promise=loaded.runAnnouncementCheck({identityProvider:{issuer:'https://project.supabase.co/auth/v1'},publicAppUrl:'https://app.example',repoUrl:'https://github.com/Owner/Repo'},'test-public-value');
    if(unauthorizedStatus===403)await promise;else await assert.rejects(promise,/ANNOUNCEMENT_CHECK_NOT_PASSED/);
    const proof=JSON.parse(written);
    assert.equal(proof.result,unauthorizedStatus===403?'ALL_CHECKS_PASSED':'CHECK_FAILED');
    assert.equal(proof.checks.length,17);assert.equal(proof.accountsCleanupOk,true);
    assert.deepEqual(removed,[fixture.editor,fixture.student]);
    assert.notEqual(proof.testedCommit,proof.buildCommit);
    for(const value of [tokenA,tokenB,'test-server-value','test-public-value','Synthetic initial content','Synthetic updated content',fixture.editor,fixture.student])assert.ok(!written.includes(value));
  }
});
