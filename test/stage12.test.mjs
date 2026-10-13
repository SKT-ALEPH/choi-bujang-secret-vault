import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import handler from '../api/checks.js';
import {CHECK_CASES,runFixedCheck,operationsReport} from '../src/operations.mjs';
import {reportRows,reportSummary,renderReport} from '../public/operations.mjs';
import {runStage12Checks} from '../src/stage12-check.mjs';
import {RULE_IDS} from '../src/decider.mjs';

test('고정 입력 API는 caller 신원/사건/경로 주입과 쓰기를 거부한다',async()=>{
 for(const req of [{method:'POST',query:{}},{method:'GET',query:{case:'s06-normal',role:'teacher'}},{method:'GET',query:{case:['s06-normal']}},{method:'GET',query:{case:'unknown'}},{method:'GET',query:{case:'constructor'}}]){
  let status,data;const res={setHeader(){},status(s){status=s;return this;},json(d){data=d;}};await handler(req,res);assert.ok([400,405].includes(status));assert.ok(data.error);
 }
 for(const name of Object.keys(CHECK_CASES)){
  const result=await runFixedCheck(name);assert.equal(result.ready,true);assert.equal(result.kind,'synthetic_input_over_http');assert.ok(result.requestId);assert.ok(result.ruleIds.every(r=>RULE_IDS.includes(r)));assert.equal(Object.hasOwn(result,'subject'),false);
 }
});
test('화면은 서버 영수증의 실패/미실행과 시간·ID를 그대로 반영하고 HTML을 실행하지 않는다',async()=>{
 const report=await operationsReport();report.verification.records=[{stage:8,type:'forbidden',kind:'live_api_protocol',caseId:'<img onerror=alert(1)>',method:'GET',path:'/notes/:id',expected:'HTTP 404',actual:'HTTP 200',result:'failed',requestId:'request-fixture',checkedAt:'2026-10-14T00:00:00.000Z'},{stage:9,type:'forbidden',kind:'synthetic_input_over_http',caseId:'not-run',method:'GET',path:'/checks',expected:'deny',result:'not_run'}];
 const nodes={};for(const id of ['#operations-summary','#operations-rows'])nodes[id]={replaceChildren(...children){this.children=children;}};
 const doc={createElement(tag){return{tag,textContent:'',children:[],append(c){this.children.push(c);}};}};
 renderReport({querySelector:id=>nodes[id]},report,doc);const rows=reportRows(report);assert.equal(rows[0][7],'실패');assert.equal(rows[1][7],'미실행');assert.equal(rows[1][8],'없음');assert.equal(nodes['#operations-rows'].children[0].children[3].textContent,'<img onerror=alert(1)>');assert.ok(reportSummary(report).some(t=>t.includes('0/41')));
});
test('12단계 제출은 독립 HTTP 20관측을 연결하고 실패 응답/네트워크 미실행에 중단한다',async()=>{
 const recorded=JSON.parse(await readFile(new URL('../config/operations-verification.json',import.meta.url),'utf8'));
 const original=globalThis.fetch,calls=[];
 const config={publicAppUrl:'https://app.example.org/',originalApiUrl:'https://database.example.org/rest/v1/notes',step:12,repoUrl:'https://github.com/fixture/vault',restoreRoute:'/api/restore/:noteId'};
 const reply=(u)=>{const url=new URL(u),path=url.pathname,id=url.searchParams.get('case');let status=200,body={error:'LOGIN_REQUIRED'},headers={};
  if(path==='/data.json')body={notes:[]};else if(path==='/notes.json')status=404;
  else if(path==='/aleph.json')body={step:12,repoUrl:config.repoUrl};else if(path==='/manifest.webmanifest')body={start_url:'/',display:'standalone'};
  else if(path==='/'){body={};headers={'x-content-type-options':'nosniff'};}
  else if(path==='/api/checks')body=id?{caseId:id,kind:'synthetic_input_over_http',ready:true}:{schema:'aleph.operations.v1',policy:{verified:true},rules:[],verification:recorded};
  else if(path==='/rest/v1/notes'){status=401;body={code:'42501',message:'permission denied'};}else status=401;
  return new Response(JSON.stringify(body),{status,headers});};
 try{globalThis.fetch=async(u,o)=>{calls.push(o.alephEvidence);return reply(u);};const out=await runStage12Checks(config);assert.equal(out.length,20);assert.equal(calls.length,20);assert.equal(new Set(calls.map(c=>c.caseId)).size,20);assert.ok(out.every(a=>/^HTTP /u.test(a.observed)));
  globalThis.fetch=async()=>new Response(JSON.stringify({notes:[{body:'leak'}]}),{status:200});await assert.rejects(()=>runStage12Checks(config));
  globalThis.fetch=async()=>{throw Error('network');};await assert.rejects(()=>runStage12Checks(config),/network/);
 }finally{globalThis.fetch=original;}
});
