import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPersonalServer} from '../personal-ai/server.mjs';
import {createWorkspaceHost} from './host.mjs';
import {loadSigner} from './wire.mjs';
import {mkdir,chmod} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createNetBirdAgent} from '../on-client/student/netbird-agent.mjs';
import {createManagedAccount} from '../on-client/student/managed-account.mjs';
export async function createWorkspaceServer(client,options){
 const host=createWorkspaceHost({client,...options});
 const directory=join(homedir(),'Library/Application Support/Keshev'),databasePath=options?.actionDatabasePath??join(directory,'agent.sqlite');
 const managedAccount=createManagedAccount({transport:host.transport});
 const agent=createNetBirdAgent({transport:host.transport,observeNetwork:host.observeNetwork,managedAccount});
 if(!options?.actionDatabasePath){await mkdir(directory,{recursive:true,mode:0o700});const db=new DatabaseSync(databasePath);db.close();await chmod(databasePath,0o600);}
 const appAssets=new Map([['/student/netbird-layout.mjs',{type:'text/javascript; charset=utf-8',bytes:await readFile(new URL('../on-client/student/netbird-layout.mjs',import.meta.url))}]]);
 const server=await createPersonalServer(client,{applicationId:'netbird-integrated',appAssets,handleBridgeRequest:agent.handle,prepareExplanation:agent.prepareExplanation,incidentRoutes:true,
   onOptions:{engine:agent.engine,scanner:options?.scanner,requestTimeoutMs:30000,readTimeoutMs:15000,
     actionConfiguration:{engine:agent.actionEngine,resolveContext:agent.resolveContext,databasePath,policy:{appId:'aleph-on',audience:'on-client',accessPolicyId:'netbird-vault',allowedActions:['device:revoke','grant:remove'],confirmationTtlMs:60000,timeoutMs:20000}}},
   transformHtml:html=>html.replace('</head>','<script type="module" src="/student/netbird-layout.mjs"></script></head>')
     .replace('id="tab-personal" data-view="personal" aria-controls="view-personal" aria-selected="true"','id="tab-personal" data-view="personal" aria-controls="view-personal" aria-selected="false"')
     .replace('aria-controls="view-protection" aria-selected="false" tabindex="-1"','aria-controls="view-protection" aria-selected="true" tabindex="0"')
     .replace('id="view-protection" class="view" role="tabpanel" aria-labelledby="tab-protection" hidden','id="view-protection" class="view" role="tabpanel" aria-labelledby="tab-protection"')});return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {createChatGPT}=await import('../personal-ai/node_modules/@siwc/local/dist/index.js'),{keychainEncryption}=await import('../personal-ai/keychain.mjs');
  const encryption=await keychainEncryption(),directory=join(homedir(),'Library/Application Support/Keshev Personal Workspace'),signer=await loadSigner(directory,encryption);
  if(process.argv.includes('--prepare-key')){console.log('개인 업무 기기키 준비 완료 · 공개키는 개인 앱 저장소의 agent-public.pem');}
  else{
   let server;const client=createChatGPT({appName:'Keshev Personal AI',appId:'keshev-personal-ai',redirectPort:0,sendHostId:true,storageDir:join(homedir(),'Library/Application Support/Keshev Personal AI'),credentialEncryption:encryption,openBrowser:url=>server.openAuthorization(url)});
   server=await createWorkspaceServer(client,{signer,accountEncryption:encryption});const port=Number(process.env.ON_PORT??5189);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
   server.on('error',()=>{console.error('개인 케셰브 실행 실패 · 포트와 실행 환경을 확인하세요.');process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`케셰브 개인 운영: http://127.0.0.1:${port}/`));
   for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
  }
 }catch{console.error('개인 케셰브 실행 실패 · Node 버전·Mac 키체인·앱 SDK와 NetBird 설정을 확인하세요.');process.exitCode=1;}
}
