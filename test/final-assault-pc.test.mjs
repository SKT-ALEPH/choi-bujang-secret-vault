import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {readPcObservation} from '../on-client/student/pc-observation.mjs';
import {createDailyServer} from '../on-client/student/start-daily.mjs';

async function using(options,run){
  const server=await createDailyServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const home=await fetch(origin),cookie=home.headers.get('set-cookie').split(';')[0];
    assert.match(cookie,/^keshev_daily_\d+=/);
    await run(origin,{cookie,'sec-fetch-site':'same-origin'});
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('actual OS measurements have units/times/provenance; disk read failure is unknown, never zero',async()=>{
  const data=await readPcObservation({diskProbe:async()=>{throw Error('private-path');}});
  assert.equal(data.readOnly,true);assert.equal(data.mode,'measured');assert.equal(data.sdp,'not_checked');
  assert.equal(data.metrics.cpu.unit,'%');assert.equal(data.metrics.memory.unit,'GiB');
  assert.ok(data.metrics.cpu.value>=0&&data.metrics.cpu.value<=100);
  for(const row of Object.values(data.metrics)){assert.ok(Number.isFinite(Date.parse(row.observedAt)));assert.ok(row.source.length>0);}
  assert.equal(data.metrics.disk.status,'unavailable');assert.equal(data.metrics.disk.value,null);
  assert.ok(!JSON.stringify(data).includes('private-path'));
});
test('PC endpoint requires its own session, exact Host and same-origin fetch; existing app stays available',async()=>{
  await using({},async(origin,headers)=>{
    assert.equal((await fetch(origin+'/api/student/pc')).status,403);
    assert.equal((await fetch(origin+'/api/student/pc',{headers:{...headers,'sec-fetch-site':'same-site'}})).status,403);
    assert.equal((await fetch(origin+'/api/student/pc',{headers:{...headers,origin:'https://outside.example.invalid'}})).status,403);
    // Fetch normalizes Host; use the raw HTTP client to actually send the wrong Host.
    const wrongHost=await new Promise((resolve,reject)=>{const req=httpRequest(origin+'/api/student/pc',{headers:{...headers,host:'outside.example.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
    assert.equal(wrongHost,403);
    assert.equal((await fetch(origin+'/api/student/pc',{method:'POST',headers})).status,405);
    const response=await fetch(origin+'/api/student/pc',{headers});assert.equal(response.status,200);
    assert.equal((await response.json()).data.readOnly,true);assert.equal(response.headers.get('cache-control'),'no-store');
    const existing=await fetch(origin+'/api/me');assert.equal((await existing.json()).meta.mode,'disconnected');
  });
});
test('overlap is refused and a stuck reader is bounded, releases busy state and exposes no diagnostics',async()=>{
  let n=0;
  await using({readTimeoutMs:50,readPc:()=>++n===1?new Promise(()=>{}):{schema:'test-only'}},async(origin,headers)=>{
    const pending=fetch(origin+'/api/student/pc',{headers});await new Promise(r=>setTimeout(r,10));
    assert.equal((await fetch(origin+'/api/student/pc',{headers})).status,429);
    const failed=await pending;assert.equal(failed.status,503);assert.deepEqual(await failed.json(),{ok:false,code:'PC_READ_UNAVAILABLE'});
    assert.equal((await fetch(origin+'/api/student/pc',{headers})).status,200);
  });
});

test('two local app copies keep independent port-specific sessions',async()=>{
  await using({},async(first,a)=>using({},async(second,b)=>{
    assert.notEqual(a.cookie.split('=')[0],b.cookie.split('=')[0]);
    const headers={...a,cookie:a.cookie+'; '+b.cookie};
    assert.equal((await fetch(first+'/api/student/pc',{headers})).status,200);
    assert.equal((await fetch(second+'/api/student/pc',{headers})).status,200);
    assert.equal((await fetch(first+'/api/student/pc',{headers:b})).status,403);
  }));
});
