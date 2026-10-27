// One local command starts the owned Windows resource and this Mac app. No secrets are printed/copied.
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,copyFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {readNetBirdStatus,overlayIp} from '../on-client/student/netbird-observation.mjs';
import {keychainEncryption} from '../personal-ai/keychain.mjs';
import {loadSigner} from './wire.mjs';
const run=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
try{
 if(process.platform!=='darwin'||process.version!=='v24.19.0')throw Error('MAC_NODE_24_19_REQUIRED');
 const args=process.argv.slice(2);if(args.some(x=>!/^--adopt-pid=\d+$/.test(x))||args.length>1)throw Error('UNKNOWN_ARGUMENT');
 const adoptPid=args.length?Number(args[0].split('=')[1]):undefined;
 // The installed manager belongs to this Mac, not to one source checkout.
 // A fresh clone must not need a copy of the install folder's credentials.
 try{
   console.log('설치된 PC 감시 서버를 준비합니다.');
   await run('docker',['desktop','start'],{timeout:60000,maxBuffer:16384});
   const role=await run('docker',['inspect','--format','{{index .Config.Labels "app.keshev.role"}}','keshev-wazuh-manager'],{timeout:5000,maxBuffer:1024});
   if(role.stdout.trim()!=='pc-security-manager')throw Error('MANAGER_NOT_OWNED');
   await run('docker',['start','keshev-wazuh-manager'],{timeout:15000,maxBuffer:1024});
 }catch{console.log('PC 감시 서버 준비를 확인하지 못했습니다. 앱의 PC 감시 상태에서 확인하세요.');}
 const n=await readNetBirdStatus(),macAddress=n.netbirdIp?.split('/')[0];if(n.daemonStatus!=='Connected'||!overlayIp(macAddress))throw Error('MAC_NETBIRD_NOT_CONNECTED');
 const plan=await run('/usr/local/bin/prlctl',['list','--all','--json'],{timeout:10000,maxBuffer:1048576});const vm=JSON.parse(plan.stdout).find(x=>x.name==='Windows 11');if(!vm)throw Error('WINDOWS_VM_NOT_FOUND');
 if(vm.status!=='running')await run('/usr/local/bin/prlctl',['start','Windows 11'],{timeout:60000});
 const keyDirectory=join(homedir(),'Library/Application Support/Keshev Personal Workspace');await loadSigner(keyDirectory,await keychainEncryption());
 const publicDirectory=join(root,'personal-workspace','runtime-public');await mkdir(publicDirectory,{recursive:true,mode:0o700});await copyFile(join(keyDirectory,'agent-public.pem'),join(publicDirectory,'agent-public.pem'));
 const homeRelative=relative(homedir(),root);if(homeRelative.startsWith('..'))throw Error('PROJECT_HOME_SHARE_REQUIRED');
 const sourceRoot='\\\\Mac\\Home\\'+homeRelative.split('/').join('\\'),publicKeyPath=sourceRoot+'\\personal-workspace\\runtime-public\\agent-public.pem';
 const config=Buffer.from(JSON.stringify({sourceRoot,publicKeyPath,macAddress,adoptPid})).toString('base64'),launcher=sourceRoot+'\\personal-workspace\\windows-launch.mjs';
 const ps="$node=Join-Path $env:USERPROFILE 'KeshevRuntime\\node-v24.19.0-win-arm64\\node.exe';if(!(Test-Path $node)){throw 'WINDOWS_NODE_24_19_REQUIRED'};$node";
 console.log('Windows 개인 업무 서버를 준비합니다. 기존 개인 자료와 계정 설정을 유지합니다.');
 const found=await run('/usr/local/bin/prlctl',['exec','Windows 11','--current-user','powershell.exe','-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(ps,'utf16le').toString('base64')],{timeout:15000,maxBuffer:16384});
 const windowsNode=found.stdout.trim();if(!/^C:\\Users\\[^\r\n]+\\node\.exe$/i.test(windowsNode))throw Error('WINDOWS_NODE_24_19_REQUIRED');
 const deployed=await run('/usr/local/bin/prlctl',['exec','Windows 11','--current-user',windowsNode,launcher,config],{timeout:30000,maxBuffer:65536});
 const result=JSON.parse(deployed.stdout.trim());if(result.started!==true||!overlayIp(result.address)||!n.peers.details?.some(p=>p.netbirdIp?.split('/')[0]===result.address))throw Error('WINDOWS_PEER_UNVERIFIED');
 // Wait only for the newly launched, fixed private health endpoint; never retry model calls or writes.
 let ready=false;for(let i=0;i<10;i++){try{const r=await fetch(`http://${result.address}:54123/keshev-health`,{signal:AbortSignal.timeout(1000),redirect:'error'});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('WINDOWS_RESOURCE_NOT_READY');
 try{const existing=await fetch('http://127.0.0.1:'+String(process.env.ON_PORT??5189)+'/',{signal:AbortSignal.timeout(1500)});const isCurrent=existing.headers.get('x-keshev-application')==='netbird-integrated';await existing.body?.cancel();if(isCurrent){console.log('Windows 서버 준비 완료. 케셰브가 이미 실행 중입니다. http://127.0.0.1:'+String(process.env.ON_PORT??5189)+'/');process.exit(0);}}catch{}
 console.log('Windows 서버 준비 완료. 케셰브를 실행합니다.');
 const child=spawn(process.execPath,['personal-workspace/server.mjs'],{cwd:root,env:{...process.env,KESHEV_NETBIRD_TARGET_IP:result.address},stdio:'inherit'});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));child.on('exit',code=>{process.exitCode=code??0;});
}catch(error){
 const known=['MAC_NODE_24_19_REQUIRED','MAC_NETBIRD_NOT_CONNECTED','WINDOWS_VM_NOT_FOUND','WINDOWS_NODE_24_19_REQUIRED','PROJECT_HOME_SHARE_REQUIRED','WINDOWS_PEER_UNVERIFIED','WINDOWS_RESOURCE_NOT_READY','UNKNOWN_ARGUMENT'];
 const childCode=String(error.stderr??'').match(/(?:Error: |: )(RESOURCE_PORT_IN_USE|WINDOWS_NODE_24_19_REQUIRED|WINDOWS_NETBIRD_NOT_CONNECTED|WINDOWS_NETBIRD_ADDRESS_UNAVAILABLE|INVALID_LAUNCH_CONFIGURATION|EPERM|ENOENT)/)?.[1];
 const code=known.includes(error.message)?error.message:childCode??'WINDOWS_START_UNAVAILABLE';console.error(`케셰브 시작을 완료하지 못했습니다 (${code}). NetBird·Windows 로그인·공유 폴더·Node 버전과 포트 사용을 확인하세요. 다른 프로세스나 기존 자료는 임의로 지우지 않습니다.`);process.exitCode=1;
}
