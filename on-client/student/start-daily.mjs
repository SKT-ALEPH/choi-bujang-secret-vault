// Student development entry; does not install or impersonate the approved packaged host.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createOnServer} from '../src/server.mjs';
import {demoEngine} from '../src/engine.mjs';
import {readPcObservation} from './pc-observation.mjs';
import {readConnectionObservation} from './connection-observation.mjs';

export async function createDailyServer({demo=false,readPc=readPcObservation,readConnections=readConnectionObservation,readTimeoutMs=3500}={}){
  if(!Number.isInteger(readTimeoutMs)||readTimeoutMs<10||readTimeoutMs>5000)throw Error('INVALID_PC_TIMEOUT');
  const server=createOnServer({engine:demo?demoEngine():{evidenceMode:'disconnected'},aiEnv:{}});
  const [providedHandler]=server.listeners('request');server.removeListener('request',providedHandler);
  const html=(await readFile(new URL('../public/index.html',import.meta.url),'utf8'))
    .replace('</head>','<link rel="stylesheet" href="/student/daily.css"><script type="module" src="/student/daily-layout.mjs"></script></head>')
    .replace('class="client-app"','class="client-app daily-app"');
  const assets=new Map(['/student/daily.css','/student/daily-layout.mjs'].map(path=>[path,new URL('.'+path.slice(8),import.meta.url)]));
  const session=randomBytes(32).toString('hex');let busy=false;
  const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  const authorized=req=>{
    const name=`keshev_daily_${server.address()?.port}=`;
    const value=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name))?.slice(name.length);
    return typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(session));
  };
  server.on('request',async(req,res)=>{
    const origin=`http://127.0.0.1:${server.address()?.port}`;
    if(req.headers.host!==origin.slice(7)){json(res,403,{ok:false,code:'PC_ORIGIN_REJECTED'});return;}
    if(assets.has(req.url)){
      if(req.method!=='GET'){json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
      try{const data=await readFile(assets.get(req.url));res.writeHead(200,{'content-type':req.url.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(data);}
      catch{json(res,404,{ok:false,code:'ASSET_UNAVAILABLE'});}return;
    }
    if(req.url==='/'||req.url==='/index.html'){
      if(req.method!=='GET'){json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','set-cookie':`keshev_daily_${server.address()?.port}=${session}; HttpOnly; SameSite=Strict; Path=/`,
        'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",'x-content-type-options':'nosniff'});
      res.end(html);return;
    }
    const read=req.url==='/api/student/pc'?readPc:req.url==='/api/student/connections'?readConnections:null;
    if(!read){providedHandler(req,res);return;}
    if(req.method!=='GET'){json(res,405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
    if(!authorized(req)||req.headers['sec-fetch-site']!=='same-origin'||req.headers.origin&&req.headers.origin!==origin){json(res,403,{ok:false,code:'PC_ORIGIN_REJECTED'});return;}
    if(busy){json(res,429,{ok:false,code:'PC_READ_BUSY'});return;}
    busy=true;let timer;
    try{const data=await Promise.race([Promise.resolve().then(read),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PC_READ_TIMEOUT')),req.url==='/api/student/connections'?8000:readTimeoutMs);})]);if(!res.destroyed)json(res,200,{ok:true,data});}
    catch{if(!res.destroyed)json(res,503,{ok:false,code:'PC_READ_UNAVAILABLE'});}
    finally{clearTimeout(timer);busy=false;}
  });
  return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.slice(2).some(x=>x!=='--demo')||process.argv.filter(x=>x==='--demo').length>1)throw Error('UNKNOWN_ARGUMENT');
  const port=Number(process.env.ON_PORT??5189);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
  const server=await createDailyServer({demo:process.argv.includes('--demo')});
  server.on('error',()=>{console.error('학생 개발 앱을 켜지 못했습니다. 포트와 실행 환경을 확인하세요.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`케셰브 학생 개발 실행: http://127.0.0.1:${port} · 승인된 설치형 실행과 별도`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();server.closeAllConnections();});
}
