import test from 'node:test';
import assert from 'node:assert/strict';
import {readConnectionObservation,readWindowsPart} from '../on-client/student/connection-observation.mjs';

test('non-Windows configuration never impersonates Windows logs, firewall or SDP',async()=>{
  const d=await readConnectionObservation({os:'darwin'});
  assert.equal(d.readOnly,true);assert.equal(d.firewall.status,'unavailable');assert.equal(d.events.status,'unavailable');assert.equal(d.sdp.status,'unavailable');
  assert.ok(!JSON.stringify(d).includes('address'));
});
test('Windows read contract strips sensitive extras and keeps per-log failure distinct from zero',async()=>{
  const end=new Date(),start=new Date(end-86400000),observedAt=end.toISOString();
  const execute=async(exe,args,options)=>{
    assert.match(exe,/powershell.exe$/);assert.equal(options.timeout,6000);assert.ok(!args.includes('-Command'));assert.ok(!args.includes('Bypass'));
    const kind=args.at(-1);
    const data=kind==='network'?{interfaces:[{state:'Up',ipv4Configured:true,ipv6Configured:false,defaultRouteConfigured:true,dnsConfigured:true,IPAddress:'private-address'}]}:kind==='firewall'?{profiles:['Domain','Private','Public'].map(profile=>({profile,enabled:'on'}))}:{startAt:start.toISOString(),endAt:end.toISOString(),logs:[{log:'System',status:'measured',warnings:0,errors:0},{log:'Application',status:'unavailable',warnings:77,errors:77,privateEvent:'secret-body'}]};
    return{stdout:JSON.stringify({status:'measured',data,observedAt,private:'secret-extra'})};
  };
  const d=await readConnectionObservation({os:'win32',execute});
  assert.equal(d.network.status,'measured');assert.equal(d.events.data.logs[0].warnings,0);assert.equal(d.events.data.logs[1].warnings,null);
  assert.ok(!/private-address|secret-body|secret-extra/.test(JSON.stringify(d)));
});
test('blocked, malformed and timed-out Windows parts are unknown with no leaked diagnostics',async()=>{
  for(const execute of [async()=>{throw Error('private-diagnostics');},async()=>({stdout:'broken-json'})]){
    const r=await readWindowsPart('firewall',{execute});assert.equal(r.status,'unavailable');assert.equal(r.data,null);assert.ok(!JSON.stringify(r).includes('private-diagnostics'));
  }
});
