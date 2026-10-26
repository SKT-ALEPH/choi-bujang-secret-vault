// macOS endpoint: native nettop counters, private metadata and an isolated PF child anchor.
// nettop is sampled: short-lived connections can be missed. Never label this a packet capture.
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {readFileSync,writeFileSync,appendFileSync,renameSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {lookup} from 'node:dns/promises';
export const ROOT='/Library/Application Support/KeshevSecurity',ANCHOR='com.apple/keshev-egress';
const file=name=>join(ROOT,name),sha=x=>createHash('sha256').update(x).digest('hex');
const policy=()=>JSON.parse(readFileSync(file('policy.json'),'utf8'));
const approvedServices=new Set(['chatgpt.com','ab.chatgpt.com','auth.openai.com','api.openai.com']),serviceAddresses=new Map();
async function refreshServices(p){
  await Promise.all((p.trustedServices??[]).filter(h=>approvedServices.has(h)).map(async h=>{
    let timer;try{const addresses=await Promise.race([lookup(h,{all:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS_TIMEOUT')),3000);})]);serviceAddresses.set(h,{at:Date.now(),addresses:addresses.map(a=>a.address)});}catch{}finally{clearTimeout(timer);}
  }));
}
function trustedService(address,port,p){return port===443&&(p.trustedServices??[]).some(h=>approvedServices.has(h)&&Date.now()-(serviceAddresses.get(h)?.at??0)<300000&&serviceAddresses.get(h)?.addresses.includes(address));}
const rows=name=>[name+'.1',name].flatMap(n=>existsSync(file(n))?readFileSync(file(n),'utf8').split('\n').filter(Boolean).map(x=>JSON.parse(x)):[]);
function append(name,value){const p=file(name);if(existsSync(p)&&statSync(p).size>100_000_000)renameSync(p,p+'.1');appendFileSync(p,JSON.stringify(value)+'\n',{mode:0o600});}
const atomic=(name,data)=>{writeFileSync(file(name+'.tmp'),JSON.stringify(data),{mode:0o600});renameSync(file(name+'.tmp'),file(name));};
export function endpoint(value){
  const m=/^(.*?)(?:\]|)(?:[:.])(\d+)$/.exec(value);if(!m)return null;
  const address=m[1].replace(/^\[/,'').replace(/%[^:]+$/,'');const port=Number(m[2]);
  return isIP(address)&&port>0&&port<=65535?{address,port}:null;
}
export function parseConnection(line){
  const fields=line.split(','),m=/^(tcp|udp)[46] (\S+)<->(\S+)$/.exec(fields[0]);if(!m)return null;
  const target=endpoint(m[3]),source=endpoint(m[2]),bytes=Number(fields[2]);
  if(!target||!source||!Number.isSafeInteger(bytes)||bytes<0)return null;
  return {key:fields[0],protocol:m[1],...target,bytes};
}
export function eligible(address,port,protocol,p){
  return Boolean(isIP(address)&&!address.startsWith('127.')&&!address.toLowerCase().startsWith('::ffff:127.')&&!['::1','0.0.0.0','::'].includes(address)&&Number.isInteger(port)&&port>0&&port<=65535&&['tcp','udp'].includes(protocol)
    &&!trustedService(address,port,p)&&!p.trustedDestinations.some(d=>d.address===address&&(d.port===0||d.port===port)&&(d.protocol==='any'||d.protocol===protocol)));
}
const rule=c=>'Keshev-Egress-'+sha(c.Destination+'|'+c.Port+'|'+c.Protocol).slice(0,24);
export function blockDeadline(previous,id,now,seconds){return previous?.Command==='add'&&previous.EventId===id&&Date.parse(previous.ExpiresAt)>now?previous.ExpiresAt:new Date(now+seconds*1000).toISOString();}
function candidate(id){if(!/^[a-f0-9-]{36}$/i.test(id??''))throw Error('EVIDENCE_INVALID');const c=rows('candidates.jsonl').find(c=>c.EventId===id);if(!c)throw Error('EVIDENCE_NOT_FOUND');return c;}
function states(){const m=new Map();for(const r of rows('responses.jsonl'))m.set(r.RuleName,r);return m;}
function pf(args,input){const r=spawnSync('/sbin/pfctl',args,{input,encoding:'utf8',timeout:10000});if(r.status!==0)throw Error('PF_OPERATION_UNVERIFIED');return r.stdout;}
function apply(command,id){
  const c=candidate(id),p=policy();if(!isIP(c.Destination)||!Number.isInteger(c.Port)||c.Port<1||c.Port>65535||!['tcp','udp'].includes(c.Protocol)||(command==='add'&&!eligible(c.Destination,c.Port,c.Protocol,p))||c.Bytes<p.thresholdBytes||c.Connections<p.minConnections)throw Error('EVIDENCE_INSUFFICIENT');
  const current=states(),name=rule(c),at=new Date();
  const intended={EventId:c.EventId,RuleName:name,Destination:c.Destination,Port:c.Port,Protocol:c.Protocol,Command:command,EffectApplied:false,At:at.toISOString(),ExpiresAt:blockDeadline(current.get(name),c.EventId,at.getTime(),p.blockSeconds)};
  current.set(name,intended);
  const active=[...current.values()].filter(r=>r.Command==='add'&&Date.parse(r.ExpiresAt)>Date.now()&&eligible(r.Destination,r.Port,r.Protocol,p));
  const rules=active.map(r=>{if(!eligible(r.Destination,r.Port,r.Protocol,p))throw Error('TARGET_INVALID');return `block drop out quick proto ${r.Protocol} from any to ${r.Destination} port ${r.Port} label "${r.RuleName}"`;}).join('\n')+'\n';
  pf(['-a',ANCHOR,'-n','-f','-'],rules);pf(['-a',ANCHOR,'-f','-'],rules);
  const observed=pf(['-a',ANCHOR,'-sr']);if(observed.includes('"'+name+'"')!==(command==='add'))throw Error('EFFECT_UNVERIFIED');
  append('responses.jsonl',{...intended,EffectApplied:true});
}
function exclusive(command,id){const r=spawnSync('/usr/bin/lockf',['-t','10',file('pf.lock'),process.execPath,fileURLToPath(import.meta.url),'apply',command,id],{timeout:20000,encoding:'utf8'});if(r.status!==0)throw Error('NATIVE_RESPONSE_UNVERIFIED');}
async function response(){
  const input=createInterface({input:process.stdin,crlfDelay:Infinity}),iterator=input[Symbol.asyncIterator]();
  const first=await iterator.next();if(first.done||first.value.length>262144)throw Error('REQUEST_INVALID');
  const m=JSON.parse(first.value),a=m.parameters?.alert;if(!['add','delete'].includes(m.command)||String(a?.rule?.id)!=='100121')throw Error('RULE_INVALID');
  const c=candidate(a.data?.keshev?.event_id);
  // Wazuh can request deletion during shutdown; the local deadline survives it.
  const previous=states().get(rule(c));if(m.command==='delete'&&previous?.Command==='add'&&Date.parse(previous.ExpiresAt)>Date.now())return;
  if(m.command==='add'){
    const age=Date.now()-Date.parse(c.ObservedAt);if(!Number.isFinite(age)||age< -30000||age>(policy().windowSeconds+30)*1000)throw Error('EVIDENCE_STALE');
    console.log(JSON.stringify({version:1,origin:{name:'keshev-egress',module:'active-response'},command:'check_keys',parameters:{keys:[rule(c)]}}));
    const next=await iterator.next();if(next.done||JSON.parse(next.value).command!=='continue')return;
  }
  exclusive(m.command,c.EventId);input.close();
}
function sensor(){
  if(!/Status:\s+Enabled/.test(pf(['-s','info']))){
    const enabled=spawnSync('/sbin/pfctl',['-E'],{encoding:'utf8',timeout:10000});
    if(enabled.status!==0)throw Error('PF_ENABLE_UNVERIFIED');writeFileSync(file('pf-reference'),enabled.stdout+enabled.stderr,{mode:0o600});
  }
  const p=policy(),previous=new Map(),samples=new Map(),emitted=new Map();let rejected=0,lastHeartbeat=0;
  const child=spawn('/usr/bin/nettop',['-L','0','-s','1','-n','-x','-J','bytes_in,bytes_out'],{stdio:['ignore','pipe','ignore']});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    if(!/^(tcp|udp)[46] /.test(line))return;const row=parseConnection(line);if(!row){rejected++;return;}
    const old=previous.get(row.key);if(!old&&previous.size>=50000){rejected++;return;}
    previous.set(row.key,{bytes:row.bytes,at:Date.now()});if(old===undefined||row.bytes<old.bytes)return;
    const bytes=row.bytes-old.bytes;if(!bytes)return;const key=row.address+'|'+row.port+'|'+row.protocol;
    if(!samples.has(key)){if(samples.size>=10000)return;samples.set(key,[]);}samples.get(key).push({at:Date.now(),bytes,connection:row.key});
  });
  const timer=setInterval(()=>{try{
    for(const [key,value]of previous)if(value.at<Date.now()-p.windowSeconds*1000)previous.delete(key);
    for(const [key,items]of samples){const recent=items.filter(r=>r.at>Date.now()-p.windowSeconds*1000);if(!recent.length){samples.delete(key);continue;}samples.set(key,recent);
      const [address,port,protocol]=key.split('|'),bytes=recent.reduce((sum,r)=>sum+r.bytes,0),connections=new Set(recent.map(r=>r.connection)).size;
      if(bytes<p.thresholdBytes||connections<p.minConnections||!eligible(address,Number(port),protocol,p)||(emitted.get(key)??0)>Date.now()-p.blockSeconds*1000)continue;
      emitted.set(key,Date.now());const c={EventId:randomUUID(),Destination:address,Port:Number(port),Protocol:protocol,Bytes:bytes,Connections:connections,Sends:recent.length,ObservedAt:new Date().toISOString(),WindowSeconds:p.windowSeconds,PolicyRevision:1};
      append('candidates.jsonl',c);append('network.jsonl',{keshev:{kind:'egress_candidate',event_id:c.EventId,dstip:address,dstport:c.Port,protocol,bytes,count:connections,window_seconds:p.windowSeconds,observed_at:c.ObservedAt,policy_revision:1}});
    }
    for(const r of states().values())if(r.Command==='add'&&r.EffectApplied&&(Date.parse(r.ExpiresAt)<=Date.now()||trustedService(r.Destination,r.Port,p)))exclusive('delete',r.EventId);
    const current=states(),pfEnabled=/Status:\s+Enabled/.test(pf(['-s','info']));let observed=pf(['-a',ANCHOR,'-sr']);
    for(const r of current.values())if(r.Command==='add'&&r.EffectApplied&&Date.parse(r.ExpiresAt)>Date.now()&&eligible(r.Destination,r.Port,r.Protocol,p)&&!observed.includes('"'+r.RuleName+'"'))exclusive('add',r.EventId);
    observed=pf(['-a',ANCHOR,'-sr']);
    const blocks=[...current.values()].map(r=>({event_id:r.EventId,rule_name:r.RuleName,port:r.Port,protocol:r.Protocol,blocked:pfEnabled&&observed.includes('"'+r.RuleName+'"')}));
    const at=new Date().toISOString();
    atomic('sensor-status.json',{schema:'keshev.nettop.status.v1',source:'macOS native nettop sampled per-connection counters',observedAt:at,monitoredFlows:samples.size,packetContents:false,rejectedRows:rejected,coverage:'sampled; short-lived connections may be missed',firewallEnabled:pfEnabled,blocks});
    if(Date.now()-lastHeartbeat>=15000){lastHeartbeat=Date.now();
      append('network.jsonl',{keshev:{kind:'endpoint_status',observed_at:at,source:'macos-nettop',coverage:'sampled',monitored_flows:samples.size,active_blocks:blocks.filter(r=>r.blocked).length,firewall_enabled:pfEnabled,rejected_rows:rejected,trusted_services_ready:[...serviceAddresses.values()].filter(s=>Date.now()-s.at<300000).length}});
      for(const r of blocks)append('network.jsonl',{keshev:{kind:'native_state',observed_at:at,...r}});
    }
  }catch{append('health.jsonl',{at:new Date().toISOString(),status:'unavailable',code:'OBSERVATION_OR_RECONCILIATION_FAILED'});}},5000);
  child.once('exit',()=>{clearInterval(timer);process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);child.kill(signal);});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{if(process.platform!=='darwin'||process.getuid()!==0)throw Error('ROOT_REQUIRED');
    const [mode,command,id]=process.argv.slice(2);await refreshServices(policy());
    if(mode==='sensor'){const refresh=setInterval(()=>refreshServices(policy()),60000);refresh.unref();}
    if(mode==='response')await response();else if(mode==='apply'&&['add','delete'].includes(command))apply(command,id);else if(mode==='sensor')sensor();else throw Error('MODE_INVALID');
  }catch{console.error('PC_SECURITY_OPERATION_UNVERIFIED');process.exitCode=1;}
}
