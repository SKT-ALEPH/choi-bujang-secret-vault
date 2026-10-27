import {mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import https from 'node:https';

const root=resolve(fileURLToPath(new URL('../',import.meta.url))),dir=join(root,'.local/server-redesign/runtime');
const config=join(dir,'config'),control=join(dir,'netbird');
for(const p of [dir,config,control])mkdirSync(p,{recursive:true,mode:0o700});chmodSync(config,0o755);
const put=(path,data,mode=0o600)=>{writeFileSync(path,data,{mode});chmodSync(path,mode);};
function run(bin,args,options={}){const r=spawnSync(bin,args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe'],...options});if(r.status!==0)throw Error('LOCAL_BOOTSTRAP_COMMAND_FAILED: '+bin+' '+args.slice(0,2).join(' '));return r.stdout.trim();}
const composeEnv=join(dir,'compose.env');
const compose=(...args)=>run('docker',['compose','--env-file',composeEnv,'-f','server-security/compose.yaml',...args]);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const secretsPath=join(dir,'bootstrap-private.json');
const secrets=existsSync(secretsPath)?JSON.parse(readFileSync(secretsPath)):{};
const save=()=>put(secretsPath,JSON.stringify(secrets));
const certificate=join(control,'tls.pem'),tlsKey=join(control,'tls.key');
if(!existsSync(certificate))run('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-days','30','-subj','/CN=netbird-control','-addext','subjectAltName=DNS:netbird-control,DNS:localhost,IP:127.0.0.1','-keyout',tlsKey,'-out',certificate]);
copyFileSync(certificate,join(config,'ca.pem'));chmodSync(join(config,'ca.pem'),0o644);
for(const key of ['relay','store'])secrets[key]??=randomBytes(32).toString('base64');save();
put(join(control,'config.yaml'),`server:
  listenAddress: ":443"
  exposedAddress: "https://netbird-control:443"
  stunPorts: [3478]
  logLevel: "warn"
  logFile: "console"
  dataDir: "/var/lib/netbird"
  disableAnonymousMetrics: true
  disableGeoliteUpdate: true
  authSecret: "${secrets.relay}"
  tls:
    certFile: "/etc/netbird/tls.pem"
    keyFile: "/etc/netbird/tls.key"
  auth:
    issuer: "https://netbird-control/oauth2"
    dashboardRedirectURIs: ["https://localhost:5295/nb-auth"]
    cliRedirectURIs: ["http://localhost:53000/"]
  store:
    engine: "sqlite"
    encryptionKey: "${secrets.store}"
`);
for(const role of ['a','b','accessor'])if(!existsSync(join(dir,role+'.env')))put(join(dir,role+'.env'),'');
put(composeEnv,`KESHEV_LOCAL_DIR=${dir}\nNB_SETUP_PAT_ENABLED=${secrets.pat?'false':'true'}\n`);
compose('up','-d','netbird-control');
const ca=readFileSync(certificate);
function api(path,method='GET',data){return new Promise((resolve,reject)=>{
  const req=https.request({hostname:'127.0.0.1',port:5295,path,method,ca,headers:{'content-type':'application/json',...(secrets.pat?{authorization:'Token '+secrets.pat}:{})},timeout:10000},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{
      if(res.statusCode>=400)return reject(Error('NETBIRD_API_'+res.statusCode+'_'+path));
      let value;try{value=JSON.parse(Buffer.concat(chunks));}catch{return reject(Error('NETBIRD_INVALID_RESPONSE'));}resolve(value);});
  });req.on('error',()=>reject(Error('NETBIRD_UNAVAILABLE')));req.on('timeout',()=>req.destroy());req.end(data?JSON.stringify(data):undefined);
});}
for(let i=0;i<60;i++){try{await api('/api/setup');break;}catch(e){if(e.message.startsWith('NETBIRD_API_'))break;if(i===59)throw Error('NETBIRD_START_TIMEOUT');await pause(1000);}}
if(!secrets.pat){
  secrets.password??=randomBytes(36).toString('base64url');save();
  const first=await api('/api/setup','POST',{email:'operator@keshev.local',name:'Local Keshev Operator',password:secrets.password,create_pat:true,pat_expire_in:7});
  if(!first.personal_access_token)throw Error('NETBIRD_SETUP_PAT_MISSING');secrets.pat=first.personal_access_token;save();
}
const groupIds={};
for(const role of ['accessor','a','b']){
  const name='keshev-local-'+role;
  let group=(await api('/api/groups')).find(g=>g.name===name);
  if(!group)group=await api('/api/groups','POST',{name,peers:[]});groupIds[role]=group.id;
  if(!secrets[role+'Setup']){
    const key=await api('/api/setup-keys','POST',{name,type:'one-off',expires_in:86400,auto_groups:[group.id],usage_limit:1,ephemeral:false});
    if(!key.key)throw Error('NETBIRD_SETUP_KEY_MISSING');secrets[role+'Setup']=key.key;save();
  }
  put(join(dir,role+'.env'),'NB_SETUP_KEY='+secrets[role+'Setup']+'\n');
}
const desired=[['accessor-to-a','accessor','a','8080'],['a-to-b','a','b','8091']];
const existing=await api('/api/policies');
for(const [name,source,target,port]of desired){if(!existing.some(p=>p.name===name))await api('/api/policies','POST',{name,description:'Keshev local validation only',enabled:true,rules:[{name,description:'One service, one direction',enabled:true,action:'accept',bidirectional:false,protocol:'tcp',ports:[port],sources:[groupIds[source]],destinations:[groupIds[target]]}]});}
for(const p of existing)if(p.name==='Default')await api('/api/policies/'+p.id,'DELETE');
compose('up','-d','netbird-a','netbird-b','netbird-accessor');
let peers;
for(let i=0;i<90;i++){
  peers=await api('/api/peers');
  if(['a','b','accessor'].every(role=>peers.some(p=>p.hostname===('keshev-local-'+(role==='accessor'?'accessor':'server-'+role))&&p.connected)))break;
  if(i===89)throw Error('NETBIRD_PEERS_TIMEOUT');await pause(1000);
}
const ips=Object.fromEntries(['a','b','accessor'].map(role=>[role,peers.find(p=>p.hostname==='keshev-local-'+(role==='accessor'?'accessor':'server-'+role)).ip]));
const publicKeys={};
const image='node:24.19.0-bookworm-slim';
for(const role of ['a','b']){
  const volume='keshev-local-security_server-'+role;
  run('docker',['volume','create',volume]);
  const script="const f=require('fs'),c=require('crypto');if(!f.existsSync('/state/private.pem')){const k=c.generateKeyPairSync('ed25519');f.writeFileSync('/state/private.pem',k.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});}f.chownSync('/state',1000,1000);f.chownSync('/state/private.pem',1000,1000);console.log(c.createPublicKey(f.readFileSync('/state/private.pem')).export({format:'pem',type:'spki'}));";
  publicKeys[role]=run('docker',['run','--rm','-v',volume+':/state',image,'node','-e',script]);
}
run('docker',['cp','keshev-wazuh-manager:/var/ossec/etc/authd.pass',join(dir,'wazuh-enrollment.pass')]);chmodSync(join(dir,'wazuh-enrollment.pass'),0o600);
run('docker',['cp','keshev-wazuh-manager:/var/ossec/etc/keshev-ca.pem',join(config,'wazuh-ca.pem')]);chmodSync(join(config,'wazuh-ca.pem'),0o644);
run('docker',['run','--rm','-v','keshev-local-security_server-a:/state','-v',join(dir,'wazuh-enrollment.pass')+':/input/pass:ro',image,'node','-e',"require('fs').copyFileSync('/input/pass','/state/wazuh-enrollment.pass');require('fs').chmodSync('/state/wazuh-enrollment.pass',0o600)"]);
const oldRuntime=existsSync(join(config,'runtime.json'))?JSON.parse(readFileSync(join(config,'runtime.json'))):{};
const runtime={...oldRuntime,aIp:ips.a,bIp:ips.b,accessorIp:ips.accessor,aPublicKey:publicKeys.a,bPublicKey:publicKeys.b,webOrigin:'https://keshev-defense-package-20261027.vercel.app',registeredAgents:oldRuntime.registeredAgents??[]};
put(join(config,'runtime.json'),JSON.stringify(runtime,null,2)+'\n',0o644);
put(composeEnv,`KESHEV_LOCAL_DIR=${dir}\nNB_SETUP_PAT_ENABLED=false\n`);
compose('up','-d','netbird-control');
console.log(JSON.stringify({prepared:true,isolatedLocalNetBird:true,peers:ips,policyNames:desired.map(p=>p[0]),keysPrinted:false,servicesStarted:false}));
