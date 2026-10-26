// Student-owned local OS reads. No external requests, event bodies, addresses or elevation.
import {platform,networkInterfaces} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const run=promisify(execFile);
const unknown=(source,reason)=>({status:'unavailable',data:null,source,reason,observedAt:new Date().toISOString()});
export async function readWindowsPart(kind,{execute=run}={}){
  if(!['network','firewall','events'].includes(kind))throw Error('INVALID_READ_KIND');
  const source={network:'Get-NetIPConfiguration -All',firewall:'Get-NetFirewallProfile -PolicyStore ActiveStore',events:'Get-WinEvent · System/Application · Level 2/3 · 최근 24시간'}[kind];
  try{
    const script=await readFile(new URL('./windows-readonly.ps1',import.meta.url),'utf8');
    // Fixed student-owned commands with an allowlisted selector; never accept command text from HTTP.
    // Do not change ExecutionPolicy or any OS/network/security setting.
    const {stdout}=await execute(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',`& { ${script} } -Kind ${kind}`],{timeout:6000,maxBuffer:65536,windowsHide:true,encoding:'utf8'});
    const result=JSON.parse(stdout.replace(/^\uFEFF/,''));
    if(result.status!=='measured'||!Number.isFinite(Date.parse(result.observedAt)))throw Error('READ_UNAVAILABLE');
    // Return only a validated contract, never raw process output or OS error messages.
    let data;
    if(kind==='network'){
      if(!Array.isArray(result.data?.interfaces)||result.data.interfaces.length>100)throw Error('INVALID_NETWORK');
      data={interfaces:result.data.interfaces.map(row=>{
        if(!['Up','Down','Disconnected','Disabled','Not Present','Unknown','Dormant','LowerLayerDown'].includes(row.state)||['ipv4Configured','ipv6Configured','defaultRouteConfigured','dnsConfigured'].some(k=>typeof row[k]!=='boolean'))throw Error('INVALID_NETWORK');
        return {state:row.state,ipv4Configured:row.ipv4Configured,ipv6Configured:row.ipv6Configured,defaultRouteConfigured:row.defaultRouteConfigured,dnsConfigured:row.dnsConfigured};
      })};
    }else if(kind==='firewall'){
      const rows=result.data?.profiles;if(!Array.isArray(rows)||rows.length!==3||new Set(rows.map(r=>r.profile)).size!==3)throw Error('INVALID_FIREWALL');
      data={profiles:rows.map(row=>{if(!['Domain','Private','Public'].includes(row.profile)||!['on','off','unknown'].includes(row.enabled))throw Error('INVALID_FIREWALL');return{profile:row.profile,enabled:row.enabled};})};
    }else{
      const {startAt,endAt,logs}=result.data??{};
      if(!Number.isFinite(Date.parse(startAt))||!Number.isFinite(Date.parse(endAt))||Math.abs(Date.parse(endAt)-Date.parse(startAt)-86400000)>1000||!Array.isArray(logs)||logs.length!==2||new Set(logs.map(r=>r.log)).size!==2)throw Error('INVALID_LOGS');
      data={startAt,endAt,logs:logs.map(row=>{
        if(!['System','Application'].includes(row.log)||!['measured','unavailable'].includes(row.status)||row.status==='measured'&&[row.warnings,row.errors].some(v=>!Number.isSafeInteger(v)||v<0||v>10000))throw Error('INVALID_LOGS');
        return {log:row.log,status:row.status,warnings:row.status==='measured'?row.warnings:null,errors:row.status==='measured'?row.errors:null};
      })};
    }
    return {status:'measured',data,source,observedAt:result.observedAt};
  }catch{return unknown(source,'일반 권한 읽기 실패·응답 시간 초과·형식 확인 불가 중 하나입니다. 권한을 높이지 않고 다시 조회하세요.');}
}
export async function readConnectionObservation({os=platform(),execute}={}){
  let network,firewall,events;
  if(os==='win32') [network,firewall,events]=await Promise.all(['network','firewall','events'].map(kind=>readWindowsPart(kind,{execute})));
  else{
    try{
      const rows=Object.values(networkInterfaces()).flat().filter(row=>!row.internal);
      network={status:'measured',data:{ipv4Count:rows.filter(r=>r.family==='IPv4').length,ipv6Count:rows.filter(r=>r.family==='IPv6').length},source:'node:os.networkInterfaces · 비루프백 주소 구성 개수만 집계',observedAt:new Date().toISOString()};
    }catch{network=unknown('node:os.networkInterfaces','일반 권한에서 구성 정보를 읽지 못했습니다.');}
    firewall=unknown('Windows ActiveStore 방화벽','이 OS는 Windows가 아니므로 Windows 방화벽 설정을 조회하지 않았습니다.');
    events=unknown('Windows System/Application','이 OS는 Windows가 아니므로 Windows 기록을 조회하지 않았습니다.');
  }
  return {schema:'keshev.student.connections.v1',mode:'measured',platform:os,readOnly:true,observedAt:new Date().toISOString(),network,firewall,events,sdp:{status:'unavailable',reason:'승인된 SDP 서버의 연결 관측이 없습니다. PC 조회 성공으로 SDP 연결을 판단하지 않습니다.'}};
}
