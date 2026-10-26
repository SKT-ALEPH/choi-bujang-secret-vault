import {createServer} from 'node:http';
import {readFile,mkdir,lstat} from 'node:fs/promises';
import {createPublicKey} from 'node:crypto';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {readNetBirdStatus,overlayIp,RESOURCE_PORT} from '../on-client/student/netbird-observation.mjs';
import {readPcObservation} from '../on-client/student/pc-observation.mjs';
import {readConnectionObservation} from '../on-client/student/connection-observation.mjs';
import {createWorkspaceStore} from './store.mjs';
import {body,verifyRequest,sha,fault} from './wire.mjs';
const codes=new Set(['ARCHIVE_CONFIRMATION_REQUIRED','JSON_REQUIRED','REQUEST_TOO_LARGE','INVALID_JSON','AGENT_SIGNATURE_REJECTED','REPLAY_REJECTED','ACTOR_INVALID','INVALID_ENVELOPE','SESSION_SCOPE_CHANGED','OWNER_NOT_REGISTERED','DEVICE_UNREGISTERED','DEVICE_REVOKED','SESSION_EXPIRED','GRANT_REMOVED','ACTION_NOT_FOUND','ACTION_INVALID','ACTION_NOT_SUPPORTED','CONFIRMATION_REQUIRED','CONFIRMATION_EXPIRED_OR_CHANGED','INPUT_INVALID','NOTE_INVALID','NOTE_NOT_FOUND','NOTE_CHANGED','NOT_FOUND']);
export function createResourceServer({client,publicKey,store}){
 const key=createPublicKey(publicKey);
 const server=createServer(async(req,res)=>{
  const send=(status,value)=>{if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));};
  try{
   if(req.socket.remoteAddress?.replace(/^::ffff:/,'')!==client)throw fault('PEER_REJECTED',403);
   const port=server.address()?.port,allowedHost=`${server.address()?.address}:${port}`;
   if(req.headers.host!==allowedHost)throw fault('PEER_REJECTED',403);
   if(req.method==='GET'&&req.url==='/keshev-health'){send(200,{ok:true,schema:'keshev.private-resource.v1',resource:'keshev-windows-check',servedAt:new Date().toISOString()});return;}
   if(req.method!=='POST'||!req.url.startsWith('/agent/')||req.url.includes('?'))throw fault('NOT_FOUND',404);
   const {bytes,data}=await body(req,65536),nonce=verifyRequest(key,req,bytes);store.acceptNonce(nonce);
   let result=store.route(req.url,data);if(req.url==='/agent/pc'){const pc=await readPcObservation(),connections=await readConnectionObservation();store.route('/agent/pc',data);result={pc,connections};}send(200,{ok:true,data:result,source:'windows-personal-workspace',checkedAt:new Date().toISOString()});
  }catch(error){const code=codes.has(error.code)?error.code:'RESOURCE_UNAVAILABLE';send(error.status??503,{ok:false,error:{code}});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.on('close',()=>store.close());return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const client=process.env.KESHEV_NETBIRD_CLIENT_IP,publicPath=process.env.KESHEV_AGENT_PUBLIC_KEY_PATH;
  if(!overlayIp(client)||!publicPath)throw Error('CONFIGURATION_REQUIRED');
  const info=await lstat(publicPath);if(!info.isFile()||info.isSymbolicLink()||info.size>4096)throw Error('PUBLIC_KEY_INVALID');
  const publicKey=await readFile(publicPath,'utf8'),key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')throw Error('PUBLIC_KEY_INVALID');
  const d=await readNetBirdStatus(),bind=d.netbirdIp?.split('/')[0];if(d.daemonStatus!=='Connected'||!overlayIp(bind))throw Error('NETBIRD_REQUIRED');
  const directory=join(process.env.LOCALAPPDATA??homedir(),'Keshev Personal Workspace');await mkdir(directory,{recursive:true});
  const canonical=key.export({type:'spki',format:'pem'}),store=createWorkspaceStore(join(directory,'workspace.sqlite'),{deviceId:'device-'+sha(canonical).slice(0,40)});
  const server=createResourceServer({client,publicKey:canonical,store});
  server.listen(RESOURCE_PORT,bind,()=>console.log('케셰브 개인 업무 서버 · NetBird TCP 54123 · 서명 검증·영속 저장 사용'));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
 }catch{console.error('개인 업무 서버 실행 실패 · NetBird 연결, 공개키 경로와 개인 저장소를 확인하세요.');process.exitCode=1;}
}
