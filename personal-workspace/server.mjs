import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPersonalServer} from '../personal-ai/server.mjs';
import {createWorkspaceHost} from './host.mjs';
import {loadSigner} from './wire.mjs';
export async function createWorkspaceServer(client,options){
 const host=createWorkspaceHost({client,...options});
 const files=['app.mjs','style.css'];const appAssets=new Map(await Promise.all(files.map(async name=>['/workspace/assets/'+name,{type:name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',bytes:await readFile(new URL('./public/'+name,import.meta.url))}])));
 const server=await createPersonalServer(client,{appHtml:await readFile(new URL('./public/index.html',import.meta.url),'utf8'),appAssets,handleAppRequest:host.handle,prepareExplanation:host.prepareExplanation});return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const {createChatGPT}=await import('../personal-ai/node_modules/@siwc/local/dist/index.js'),{keychainEncryption}=await import('../personal-ai/keychain.mjs');
  const encryption=await keychainEncryption(),directory=join(homedir(),'Library/Application Support/Keshev Personal Workspace'),signer=await loadSigner(directory,encryption);
  if(process.argv.includes('--prepare-key')){console.log('개인 업무 기기키 준비 완료 · 공개키는 개인 앱 저장소의 agent-public.pem');}
  else{
   let server;const client=createChatGPT({appName:'Keshev Personal AI',appId:'keshev-personal-ai',redirectPort:0,sendHostId:true,storageDir:join(homedir(),'Library/Application Support/Keshev Personal AI'),credentialEncryption:encryption,openBrowser:url=>server.openAuthorization(url)});
   server=await createWorkspaceServer(client,{signer});const port=Number(process.env.ON_PORT??5189);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
   server.on('error',()=>{console.error('개인 케셰브 실행 실패 · 포트와 실행 환경을 확인하세요.');process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`케셰브 개인 운영: http://127.0.0.1:${port}/`));
   for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
  }
 }catch{console.error('개인 케셰브 실행 실패 · Node 버전·Mac 키체인·앱 SDK와 NetBird 설정을 확인하세요.');process.exitCode=1;}
}
