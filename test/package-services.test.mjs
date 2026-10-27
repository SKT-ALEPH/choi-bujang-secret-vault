import test from 'node:test';
import assert from 'node:assert/strict';
import {createAiHandler} from '../api/ai.js';
import {createThreatIntelHandler} from '../api/threat-intel.js';
import {createThreatIntelReader,compareCveVersion,COMPONENTS,CACHE_MS,NVD_URL,KEV_URL} from '../src/threat-intel.mjs';

const input={level:4,failureCount:6,accountCount:1,multiAccount:false,samePassword:false};
async function call(handler,overrides={}){
  const headers=new Map();let status,body;
  await handler({method:'POST',query:{},headers:{authorization:'Bearer fixture.user.a','content-type':'application/json'},body:input,...overrides},
    {setHeader:(k,v)=>headers.set(k.toLowerCase(),v),status:n=>{status=n;return {json:value=>{body=value;}};}});
  return {status,body,headers};
}
test('server AI rejects anonymous and forged scope, reserves per verified user before inference, and retains limits across handler restart',async()=>{
  const counts=new Map();let calls=0,enabled=true,dbAvailable=true,gateway=true;
  const services={verifyLoginAuthorization:async value=>value==='Bearer fixture.user.a'?{userId:'verified-a'}:value==='Bearer fixture.user.b'?{userId:'verified-b'}:null,
    authorizeGateway:async()=>gateway,
    database:{rpc(name,args){assert.equal(name,'package_reserve_ai_call');return {abortSignal:async()=>{
      if(!dbAvailable)return {error:{}};
      const used=counts.get(args.p_user)??0,allowed=used<args.p_limit;
      if(allowed)counts.set(args.p_user,used+1);
      return {data:{allowed,used:allowed?used+1:used,remaining:Math.max(0,args.p_limit-(allowed?used+1:used)),limit:args.p_limit,resetsAt:'2030-01-02T00:00:00Z'}};
    }};}},
  };
  const make=()=>createAiHandler({getRuntime:()=>services,dailyLimit:2,ask:async()=>{calls++;return enabled?0.7:null;}});
  let api=make();assert.equal((await call(api,{headers:{}})).status,401);
  assert.equal((await call(api,{headers:{authorization:'Bearer unknown.user.token'}})).status,401);
  assert.equal((await call(api,{body:{...input,userId:'victim'}})).status,400);assert.equal(calls,0);
  gateway=false;assert.equal((await call(api)).status,403);gateway=true;
  assert.equal((await call(api)).status,200);enabled=false;
  assert.equal((await call(api)).status,502);api=make();
  const limited=await call(api);assert.equal(limited.status,429);assert.equal(limited.body.error,'AI_DAILY_LIMIT');assert.equal(calls,2);
  enabled=true;assert.equal((await call(api,{headers:{authorization:'Bearer fixture.user.b','content-type':'application/json'}})).status,200);
  const stuck=createAiHandler({getRuntime:()=>services,dailyLimit:2,providerTimeoutMs:20,ask:()=>new Promise(()=>{})});
  assert.equal((await call(stuck,{headers:{authorization:'Bearer fixture.user.b','content-type':'application/json'}})).status,502);
  dbAvailable=false;assert.equal((await call(api)).status,503);assert.equal(calls,3);
});

const cve=(criteria,extra={})=>({configurations:[{nodes:[{operator:'OR',negate:false,cpeMatch:[{vulnerable:true,criteria,...extra}]}]}]});
test('NVD version comparison handles inclusive bounds and leaves environment expressions and ambiguous versions for review',()=>{
  const node=COMPONENTS.node,pattern='cpe:2.3:a:nodejs:nodejs:*:*:*:*:*:*:*:*';
  assert.equal(compareCveVersion(cve(pattern,{versionEndIncluding:node.version}),node),'version_range_match');
  assert.equal(compareCveVersion(cve(pattern,{versionEndExcluding:node.version}),node),'outside_listed_ranges');
  assert.equal(compareCveVersion(cve(pattern,{versionStartIncluding:'25.0.0'}),node),'outside_listed_ranges');
  assert.equal(compareCveVersion(cve(pattern),node),'needs_review');
  assert.equal(compareCveVersion(cve(pattern,{versionEndIncluding:'25.0.0-beta'}),node),'needs_review');
  const complex=cve(pattern,{versionEndIncluding:'99.0.0'});complex.configurations[0].nodes[0].operator='AND';
  assert.equal(compareCveVersion(complex,node),'needs_review');
  assert.equal(compareCveVersion(cve(pattern),COMPONENTS.jose),'needs_review');
  assert.equal(compareCveVersion(cve(pattern.replace(':nodejs:nodejs:',':other_vendor:nodejs:'),{versionEndIncluding:'99.0.0'}),node),'needs_review');
});

test('official NVD/KEV results retain independent fetch times, survive cache reload and never turn source failure into no findings',async()=>{
  let clock=Date.parse('2026-10-27T00:00:00Z'),calls=0,broken=false;const saved=new Map();
  const cache={read:async key=>saved.get(key),write:async(key,payload,at)=>saved.set(key,{payload,fetched_at:at.replace('Z','+00:00')})};
  const request=async(url,options)=>{
    calls++;assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
    assert.ok(url===KEV_URL||url.startsWith(NVD_URL+'?'));if(broken)throw Error('private-upstream-error');
    if(url===KEV_URL)return Response.json({catalogVersion:'fixture',dateReleased:'2026-10-26T00:00:00Z',count:1,vulnerabilities:[{cveID:'CVE-2026-12345'}]});
    return Response.json({format:'NVD_CVE',totalResults:1,startIndex:0,vulnerabilities:[{cve:{id:'CVE-2026-12345',published:'2026-01-01T00:00:00Z',lastModified:'2026-10-26T00:00:00Z',descriptions:[{lang:'en',value:'Fixture text, not a real advisory.'}],...cve('cpe:2.3:a:nodejs:nodejs:*:*:*:*:*:*:*:*',{versionEndIncluding:'99.0.0'})}}]});
  };
  let read=createThreatIntelReader({cache,request,now:()=>clock});
  const first=await read('node');assert.equal(calls,2);assert.equal(first.findings[0].inKev,true);assert.equal(first.findings[0].versionComparison,'version_range_match');
  const at=first.sources.nvd.fetchedAt;clock+=1000;read=createThreatIntelReader({cache,request,now:()=>clock});
  const next=await read('node');assert.equal(calls,2);assert.equal(next.sources.nvd.cached,true);assert.equal(next.sources.nvd.fetchedAt,at);
  await assert.rejects(read('https://outside.invalid'),/THREAT_COMPONENT_INVALID/);assert.equal(calls,2);
  clock+=CACHE_MS;broken=true;await assert.rejects(read('node'),/private-upstream-error/);
  assert.equal(saved.get('nvd:node:0').payload.fetchedAt,at,'failed refresh must not advance the successful timestamp');
});

test('threat endpoint authenticates and rejects arbitrary URLs, duplicate selectors and provider diagnostics',async()=>{
  let reads=0;
  const services={verifyLoginAuthorization:async()=>({userId:'verified'}),authorizeGateway:async()=>true};
  const api=createThreatIntelHandler({getRuntime:()=>services,read:async key=>{reads++;return {component:key};}});
  assert.equal((await call(api,{method:'GET',headers:{}})).status,401);
  assert.equal((await call(api,{method:'GET',query:{url:'https://outside.invalid'}})).status,400);
  assert.equal((await call(api,{method:'GET',query:{component:['node','jose']}})).status,400);
  assert.equal(reads,0);assert.equal((await call(api,{method:'GET',query:{component:'node'}})).status,200);assert.equal(reads,1);
  const failed=createThreatIntelHandler({getRuntime:()=>services,read:async()=>{throw Error('private-diagnostics');}});
  const r=await call(failed,{method:'GET'});assert.equal(r.status,503);assert.equal(JSON.stringify(r.body).includes('private-diagnostics'),false);
});
