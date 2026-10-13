import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runAttackChecks} from '../src/attack-check.mjs';

test('each HTTP check has distinct runner evidence without transmitting metadata, and a leaked response fails',async()=>{
  const config=JSON.parse(await readFile(new URL('../aleph.config.json',import.meta.url),'utf8'));
  const actualFetch=globalThis.fetch,requests=[];
  let leak=false;
  try{
    globalThis.fetch=async(target,options)=>{
      const url=new URL(target);requests.push({url,options});
      if((options.method??'GET')!=='GET')throw Error('READ_ONLY_TRANSPORT');
      if(url.pathname==='/aleph.json')return Response.json(config);
      if(url.pathname==='/manifest.webmanifest')return Response.json({start_url:'/',display:'standalone',name:'Synthetic app'});
      if(url.pathname==='/offline.html')return new Response('인터넷 연결이 필요합니다');
      if(url.pathname==='/api/auth')return Response.json({error:'NOT_FOUND'},{status:404});
      if(url.pathname.startsWith('/api/')||url.pathname==='/rest/v1/notes'){
        return leak?Response.json({notes:[{body:'Synthetic leaked data'}]}):Response.json({error:'LOGIN_REQUIRED'},{status:401});
      }
      return new Response('{}',{headers:{'X-Content-Type-Options':'nosniff'}});
    };
    const attempts=await runAttackChecks(config);
    assert.equal(requests.length,15);
    assert.ok(requests.every(({options})=>(options.method??'GET')==='GET'));
    assert.equal(attempts.some(a=>a.observed.startsWith('실패')),false);
    const keys=new Set(),ids=new Set(attempts.map(a=>a.attackId));
    for(const {url,options} of requests){
      const evidence=options.alephEvidence;
      assert.deepEqual(Object.keys(evidence).sort(),['caseId','requestKey']);
      assert.ok(ids.has(evidence.caseId));
      assert.match(evidence.requestKey,/^[a-z0-9-]+$/u);
      const key=evidence.caseId+':'+evidence.requestKey;
      assert.equal(keys.has(key),false);keys.add(key);
      assert.equal(url.searchParams.has('alephEvidence'),false);
      assert.equal(new Headers(options.headers).has('alephEvidence'),false);
      assert.equal(new Headers(options.headers).has('caseId'),false);
      assert.equal(new Headers(options.headers).has('requestKey'),false);
    }
    leak=true;
    const failed=await runAttackChecks(config);
    assert.ok(failed.find(a=>a.attackId==='anonymous_get').observed.startsWith('실패'));
  }finally{globalThis.fetch=actualFetch;}
});
