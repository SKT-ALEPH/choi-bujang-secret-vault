// Harmless Windows resource, available only on this peer's overlay address to one client.
// Does not serve files, take commands, expose Keshev sessions, or change any OS settings.
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readNetBirdStatus,overlayIp,RESOURCE_PORT} from './netbird-observation.mjs';
export function createResourceServer({bind,client}){
  if(!overlayIp(bind)||!overlayIp(client)||bind===client)throw Error('INVALID_OVERLAY_ADDRESSES');
  return createServer((req,res)=>{
    const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');
    const allowed=remote===client&&req.headers.host===`${bind}:${RESOURCE_PORT}`;
    const status=!allowed?403:req.method!=='GET'?405:req.url!=='/keshev-health'?404:200;
    res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(status===200?{ok:true,schema:'keshev.private-resource.v1',resource:'keshev-windows-check',servedAt:new Date().toISOString()}:{ok:false}));
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const client=process.env.KESHEV_NETBIRD_CLIENT_IP,d=await readNetBirdStatus();
  const bind=d.netbirdIp?.split('/')[0];
  if(d.daemonStatus!=='Connected')throw Error('NETBIRD_NOT_CONNECTED');
  const server=createResourceServer({bind,client});
  server.on('error',()=>{console.error('사설 확인 자원을 켜지 못했습니다. NetBird 상태와 전용 포트를 확인하세요.');process.exitCode=1;});
  server.listen(RESOURCE_PORT,bind,()=>console.log('케셰브 Windows 사설 확인 자원 실행 · NetBird 주소 전용 · TCP 54123'));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
}
