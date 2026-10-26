// Called by the Mac launcher through Parallels' local exec channel, as the normal Windows user.
import {mkdirSync,copyFileSync,existsSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const config=JSON.parse(Buffer.from(process.argv[2]??'','base64').toString('utf8'));
if(!/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(config.macAddress)||typeof config.sourceRoot!=='string'||!config.sourceRoot.startsWith('\\\\Mac\\Home\\')||!config.publicKeyPath.startsWith('\\\\Mac\\Home\\'))throw Error('INVALID_LAUNCH_CONFIGURATION');
if(process.version!=='v24.19.0')throw Error('NODE_24_19_REQUIRED');
const root=join(process.env.LOCALAPPDATA,'KeshevPersonalWorkspaceRuntime'),data=join(process.env.LOCALAPPDATA,'Keshev Personal Workspace');
const metadata=join(root,'resource-process.json');let previous;try{previous=JSON.parse(readFileSync(metadata,'utf8')).pid;}catch{}
const portScript="$p=Get-NetTCPConnection -LocalPort 54123 -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1;if($p){$c=Get-CimInstance Win32_Process -Filter ('ProcessId='+$p.OwningProcess);[pscustomobject]@{pid=$p.OwningProcess;isNode=($c.ExecutablePath -eq '"+process.execPath.replaceAll("'","''")+"');isResource=($c.CommandLine -match 'personal-workspace[\\\\/]resource.mjs')}|ConvertTo-Json -Compress}else{'null'}";
const current=JSON.parse(execFileSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(portScript,'utf16le').toString('base64')],{encoding:'utf8',timeout:15000}).trim());
if(current&&(!current.isNode||!current.isResource||current.pid!==previous&&current.pid!==config.adoptPid))throw Error('RESOURCE_PORT_IN_USE');
if(current)process.kill(current.pid);
mkdirSync(join(root,'personal-workspace'),{recursive:true});mkdirSync(join(root,'on-client','student'),{recursive:true});mkdirSync(data,{recursive:true});
const copy=(from,to)=>{if(existsSync(to))chmodSync(to,0o600);copyFileSync(from,to);};
for(const name of ['wire.mjs','store.mjs','resource.mjs'])copy(join(config.sourceRoot,'personal-workspace',name),join(root,'personal-workspace',name));
for(const name of ['netbird-observation.mjs','pc-observation.mjs','connection-observation.mjs','windows-readonly.ps1'])copy(join(config.sourceRoot,'on-client','student',name),join(root,'on-client','student',name));
copy(config.publicKeyPath,join(data,'agent-public.pem'));
const status=JSON.parse(execFileSync('C:\\Program Files\\NetBird\\netbird.exe',['status','--json'],{encoding:'utf8',timeout:5000}));if(status.daemonStatus!=='Connected')throw Error('WINDOWS_NETBIRD_NOT_CONNECTED');
const address=status.netbirdIp?.split('/')[0];if(typeof address!=='string'||!/^100\./.test(address))throw Error('WINDOWS_NETBIRD_ADDRESS_UNAVAILABLE');
const child=spawn(process.execPath,['personal-workspace/resource.mjs'],{cwd:root,env:{...process.env,KESHEV_NETBIRD_CLIENT_IP:config.macAddress,KESHEV_AGENT_PUBLIC_KEY_PATH:join(data,'agent-public.pem')},detached:true,stdio:'ignore',windowsHide:true});child.unref();
writeFileSync(metadata,JSON.stringify({pid:child.pid,port:54123,startedAt:new Date().toISOString()}));console.log(JSON.stringify({started:true,pid:child.pid,address}));
