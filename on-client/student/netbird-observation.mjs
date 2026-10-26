// Read official CLI status, then probe one explicitly configured overlay resource.
// Never read NetBird config/key files or return raw CLI output, names, keys or addresses.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {platform} from 'node:os';
const execute=promisify(execFile);
export const RESOURCE_PORT=54123;
export const overlayIp=value=>typeof value==='string'&&/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.(?:\d{1,3})\.(?:\d{1,3})$/.test(value)&&value.split('.').every(n=>Number(n)<=255);
const cliPath=()=>platform()==='win32'?'C:\\Program Files\\NetBird\\netbird.exe':platform()==='darwin'?'/usr/local/bin/netbird':'/usr/bin/netbird';
export async function readNetBirdStatus({run=execute}={}){
  const {stdout}=await run(cliPath(),['status','--json'],{timeout:4000,maxBuffer:262144,windowsHide:true,encoding:'utf8'});
  const d=JSON.parse(stdout.replace(/^\uFEFF/,''));
  if(!['Connected','Connecting','Disconnected','NeedsLogin','LoginFailed','Idle'].includes(d.daemonStatus)||typeof d.management?.connected!=='boolean'||typeof d.signal?.connected!=='boolean'||![d.peers?.total,d.peers?.connected].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000)||d.peers.connected>d.peers.total||typeof d.cliVersion!=='string'||!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(d.cliVersion))throw Error('NETBIRD_INVALID_STATUS');
  return d;
}
export async function readNetBirdObservation({run,request=fetch,target=process.env.KESHEV_NETBIRD_TARGET_IP}={}){
  const result={schema:'keshev.student.netbird.v1',observedAt:new Date().toISOString(),source:'NetBird CLI · status --json',status:'unavailable',connection:null,resource:{status:'not_configured',port:RESOURCE_PORT}};
  let d;
  try{
    d=await readNetBirdStatus({run});
    result.status='measured';
    result.connection={version:d.cliVersion,daemon:d.daemonStatus,management:d.management.connected,signal:d.signal.connected,peersTotal:d.peers.total,peersConnected:d.peers.connected};
  }catch{return {...result,resource:{status:'not_checked',port:RESOURCE_PORT}};}
  if(!target)return result;
  // Only the configured CGNAT address of a peer currently known by NetBird is eligible.
  // No URL, command, address or port is accepted from an HTTP request.
  if(!overlayIp(target)||!Array.isArray(d.peers.details)||!d.peers.details.some(p=>typeof p?.netbirdIp==='string'&&p.netbirdIp.split('/')[0]===target))return {...result,resource:{status:'peer_unavailable',port:RESOURCE_PORT}};
  if(d.daemonStatus!=='Connected'||!d.management.connected)return {...result,resource:{status:'not_checked',port:RESOURCE_PORT}};
  try{
    const response=await request(`http://${target}:${RESOURCE_PORT}/keshev-health`,{signal:AbortSignal.timeout(2500),redirect:'error',cache:'no-store'});
    if(response.status!==200)throw Error('UNEXPECTED_RESPONSE');
    const reader=response.body.getReader();let body='',size=0;
    try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2048)throw Error('RESPONSE_TOO_LARGE');body+=new TextDecoder().decode(part.value,{stream:true});}}finally{await reader.cancel();}
    const data=JSON.parse(body);
    if(data.schema!=='keshev.private-resource.v1'||data.resource!=='keshev-windows-check'||data.ok!==true||!Number.isFinite(Date.parse(data.servedAt)))throw Error('UNEXPECTED_RESPONSE');
    result.resource={status:'reachable',port:RESOURCE_PORT,servedAt:data.servedAt};
  }catch{result.resource={status:'unreachable',port:RESOURCE_PORT};}
  return result;
}
