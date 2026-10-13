import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';

// Reproduce the documented capabilities, not the private judge implementation.
// Real GET/HEAD HTTP; actual read-only Git; output captured instead of replacing a bundle.
test('12단계 제출은 제한된 모듈·Git 읽기·GET/HEAD만으로 실제 HTTP 관측을 끝낸다',async()=>{
 const root=process.env.ALEPH_SANDBOX_TEST_ROOT??path.resolve(import.meta.dirname,'..'),cache=new Map(),requests=[],commands=[];
 let output,stderr='';const safeProcess={env:{},exitCode:0,stdout:{write(){}},stderr:{write(t){stderr+=t;}}};
 const within=file=>{const name=url.fileURLToPath(file instanceof URL?file:url.pathToFileURL(file));if(!name.startsWith(root+path.sep))throw Error('READ_OUTSIDE_REPOSITORY');return name;};
 const builtins={
  'node:fs':{readFileSync:(file,encoding)=>readFileSync(within(file),encoding),mkdirSync(){},writeFileSync(file,text){assert.equal(within(file),path.join(root,'artifacts/submission.json'));output=JSON.parse(text);}},
  'node:path':{join:path.join,resolve:path.resolve},'node:url':{pathToFileURL:url.pathToFileURL},
  'node:crypto':{randomUUID,createHash(algorithm){assert.equal(algorithm,'sha256');return createHash(algorithm);}},
  'node:child_process':{execFileSync(command,args,options){
   assert.equal(command,'git');const sub=args;
   assert.ok(['status','rev-parse','diff-tree','show'].includes(sub[0])||sub[0]==='config'&&sub.includes('--get')||sub[0]==='remote'&&sub[1]==='get-url','read-only Git command required');
   if(sub[0]==='show')assert.equal(sub[1],'HEAD:aleph.config.json');
   assert.equal(options.cwd,root);commands.push(sub[0]);return execFileSync(command,args,{...options,env:{PATH:process.env.PATH,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
  }},
 };
 const context=createContext({URL,process:safeProcess,fetch:async(target,options={})=>{
  const targetUrl=new URL(target);assert.equal(targetUrl.protocol,'https:');assert.equal(targetUrl.username,'');assert.equal(targetUrl.password,'');
  assert.ok(['GET','HEAD'].includes(options.method??'GET'),'write request is unavailable');requests.push({caseId:options.alephEvidence?.caseId,method:options.method??'GET'});
  return fetch(target,{...options,signal:AbortSignal.timeout(10000)});
 }});
 async function load(id){
  if(cache.has(id))return cache.get(id);
  if(id.startsWith('node:')){
   if(!Object.hasOwn(builtins,id))throw Error('UNSUPPORTED_IMPORT: '+id);
   const values=builtins[id],m=new SyntheticModule(Object.keys(values),function(){for(const[k,v]of Object.entries(values))this.setExport(k,v);},{context,identifier:id});cache.set(id,m);return m;
  }
  within(new URL(id));
  const m=new SourceTextModule(readFileSync(new URL(id),'utf8'),{context,identifier:id,
   initializeImportMeta(meta){meta.url=id;meta.dirname=path.dirname(url.fileURLToPath(id));},
   importModuleDynamically:async(specifier,parent)=>{const child=await load(specifier.startsWith('node:')?specifier:new URL(specifier,parent.identifier).href);if(child.status==='unlinked')await child.link(link);if(child.status==='linked')await child.evaluate();return child;}});
  cache.set(id,m);await m.link(link);return m;
 }
 const link=(specifier,parent)=>load(specifier.startsWith('node:')?specifier:new URL(specifier,parent.identifier).href);
 const module=await load(url.pathToFileURL(path.join(root,'scripts/bundle.mjs')).href);await module.evaluate();
 assert.equal(safeProcess.exitCode,0,stderr);assert.ok(output,'fresh bundle required');assert.equal(output.step,12);assert.equal(output.attackAttempts.length,20);
 assert.ok(requests.length>=19);assert.ok(requests.every(r=>r.caseId));assert.ok(output.attackAttempts.some(r=>r.observed.startsWith('not_run')));
 console.log(JSON.stringify({kind:'documented_sandbox_reproduction',requests:requests.length,gitReads:commands.length,notRun:output.attackAttempts.filter(r=>r.observed.startsWith('not_run')).length,commit:output.commit}));
});
