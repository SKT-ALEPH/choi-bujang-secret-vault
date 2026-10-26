import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {canonicalTarget} from '../../public/device-message.mjs';
import {validateVaultRequest} from './netbird-vault.mjs';
import {projectVaultEvent,PROJECT,vaultDigest} from './netbird-events.mjs';
import {engineError} from '../src/engine.mjs';
import {readPcObservation} from './pc-observation.mjs';
import {readConnectionObservation} from './connection-observation.mjs';
import config from '../../aleph.config.json' with {type:'json'};

const root=new URL('../../',import.meta.url);
const safeError=error=>({code:error.code??'VAULT_UNAVAILABLE',message:({VAULT_SIGN_IN_REQUIRED:'기존 자료실에서 로그인하고 기기를 승인하세요.',DEVICE_REVOKED:'이 기기의 기존 자료실 접근이 철회됐습니다.',GRANT_REMOVED:'이 기기의 기존 자료실 이용 권한이 회수됐습니다.'})[error.code]??'NetBird와 기존 자료실 연결을 확인하세요.'});
export function createNetBirdAgent({transport,observeNetwork,managedAccount,directRequest=fetch}){
  let authorization=null,approved=false,approvalExpires=0,epoch=0;
  function clear(){authorization=null;approved=false;approvalExpires=0;epoch++;}
  function captureSession(result){if(result.status<300&&typeof result.data?.access_token==='string'){const next='Bearer '+result.data.access_token;if(authorization!==next){authorization=next;approved=false;approvalExpires=0;epoch++;}}}
  async function control(operation,input={},signal){
    if(!authorization)throw engineError('ENGINE_NOT_CONNECTED','기존 자료실에서 로그인하세요.');
    const current=authorization,generation=epoch;
    const result=await transport('/agent/vault/control',{authorization:current,operation,input},signal);
    if(current!==authorization||generation!==epoch)throw engineError('SUBJECT_SCOPE_UNVERIFIED','작업 중 자료실 계정이 바뀌었습니다.');return result;
  }
  async function context(signal){return control('context',{},signal);}
  function assertScope(scope,source){if(scope&&(scope.subjectId!==source.subjectId||scope.projectId!==PROJECT))throw engineError('SUBJECT_SCOPE_UNVERIFIED','현재 사용자 범위가 아닙니다.');}
  const engine={evidenceMode:'connected',projectId:PROJECT,
    async readIdentity({signal}={}){const m=await context(signal);return {user:{id:m.subjectId,label:'기존 자료실 계정'},device:{id:m.status.device.id,label:'내 Mac · NetBird',status:'unknown'},session:{id:m.status.session.id,status:['active','revoked','expired'].includes(m.status.session.state)?m.status.session.state:'unknown'}};},
    async readApps(scope,{signal}={}){const m=await context(signal);assertScope(scope,m);return [{id:'vault',name:'기존 자료실',subjectId:m.subjectId,projectId:PROJECT},{id:'announcements',name:'기존 공지 자료',subjectId:m.subjectId,projectId:PROJECT}];},
    async readEvents(scope,{signal}={}){const m=await control('events',{},signal);assertScope(scope,m);return m.events.map(e=>projectVaultEvent(e,m.subjectId));},
    async readDevices(scope,{signal}={}){const m=await context(signal);assertScope(scope,m);return [{id:m.status.device.id,label:'내 Mac · NetBird',status:'unknown',subjectId:m.subjectId,projectId:PROJECT}];},
    async readSessions(scope,{signal}={}){const m=await context(signal);assertScope(scope,m);return [{id:m.status.session.id,status:['active','revoked','expired'].includes(m.status.session.state)?m.status.session.state:'unknown',subjectId:m.subjectId,projectId:PROJECT}];},
    async decideAccess({appId,requestId},scope,{signal}={}){
      if(!['vault','announcements'].includes(appId))throw engineError('APP_NOT_FOUND','등록된 자료실 앱이 아닙니다.',404);
      const m=await control('access',{appId:'private-workspace'},signal);assertScope(scope,m);
      const decision=m.decision==='allow'&&(!approved||approvalExpires>0&&approvalExpires<=Date.now())?'challenge':m.decision;
      return {appId,requestId,subjectId:m.subjectId,projectId:PROJECT,decision,
        reason:decision==='allow'?'NetBird 게이트웨이가 접근을 허용했습니다. 자료 요청마다 기존 서버가 기기 서명과 자료 권한을 다시 검사합니다.':decision==='challenge'?'기존 자료실에서 이 브라우저의 기기 승인을 완료하세요.':decision==='deny'?'NetBird 게이트웨이가 이 기기의 자료실 접근을 차단했습니다.':'현재 원천의 상태를 확인하지 못했습니다.',checkedAt:m.checkedAt};
    },
  };
  const actionEngine={evidenceMode:'connected',
    readEvents:(scope,{signal}={})=>control('actionEvents',{},signal),
    authorizeAction:(command,scope,{signal}={})=>control('authorizeCommand',command,signal),
    executeAction:(command,scope,{signal}={})=>control('executeCommand',command,signal),
    readActionResult:(command,scope,{signal}={})=>control('readCommand',{requestId:command.requestId},signal),
    readActionReceipt:({requestId},scope,{signal}={})=>control('readCommand',{requestId},signal),
    readOwnRevokedReceipt:({requestId},scope,{signal}={})=>control('readCommand',{requestId},signal),
  };
  async function handle(req,res){
    const path=req.url.split('?')[0];
    if(path==='/api/netbird/verify-direct'){
      try{
        if(req.method!=='POST'||!authorization)throw Error();
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)throw Error();chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!input||Object.keys(input).length!==1||!input.headers||input.headers.authorization!==authorization)throw Error();
        const request={method:'GET',path:'/api/my/notes',headers:input.headers,body:''};validateVaultRequest(request);
        if(!['x-aleph-device','x-aleph-at','x-aleph-nonce','x-aleph-signature'].every(k=>typeof request.headers[k]==='string'&&request.headers[k]))throw Error();
        const current=authorization,generation=epoch;
        const direct=await directRequest(config.publicAppUrl+request.path,{headers:request.headers,redirect:'error',signal:AbortSignal.timeout(15000)});
        await direct.body?.cancel();
        const privateResult=await transport('/agent/vault/relay',request);
        if(current!==authorization||generation!==epoch)throw Error();
        const data={directStatus:direct.status,privateStatus:privateResult.status,sameBrowserProof:true,passed:direct.status===403&&privateResult.status===200,checkedAt:new Date().toISOString()};
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data}));
      }catch{res.writeHead(409,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:{code:'VERIFY_UNAVAILABLE'}}));}return true;
    }
    if(path==='/api/netbird/session'){
      try{
        if(req.method!=='GET')throw Error();const m=await context(),claims=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString('utf8'));
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data:{access_token:authorization.slice(7),expires_at:claims.exp,user:{id:m.subjectId}}}));
      }catch{res.writeHead(401,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:{code:'VAULT_SIGN_IN_REQUIRED',message:'기존 자료실 계정으로 로그인하세요.'}}));}return true;
    }
    if(path==='/api/netbird/account'){
      try{
        if(req.method!=='POST'||!managedAccount)throw Object.assign(Error(),{code:'ACCOUNT_SETUP_UNAVAILABLE'});
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2048)throw Error();chunks.push(chunk);}
        const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!input||Object.keys(input).some(k=>!['operation','email','tokenHash','type'].includes(k)))throw Error();
        const result=await managedAccount(input);captureSession(result);res.writeHead(result.status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(result.data));
      }catch(error){res.writeHead(409,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({code:/^ACCOUNT_[A-Z_]+$/.test(error.code??'')?error.code:'ACCOUNT_SETUP_UNAVAILABLE',msg:'계정 준비 상태를 확인하지 못했습니다. 기존 계정 비밀번호를 변경하거나 인증을 우회하지 않았습니다.'}));}return true;
    }
    const observations={'/api/student/pc':readPcObservation,'/api/student/connections':readConnectionObservation,'/api/student/netbird':observeNetwork};
    if(Object.hasOwn(observations,path)){
      try{if(req.method!=='GET')throw Error();const data=await observations[path]();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data}));}
      catch{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:{message:'실제 관측을 완료하지 못했습니다.'}}));}return true;
    }
    if(path==='/api/netbird/network'){
      try{if(req.method!=='GET')throw Error();const data=await observeNetwork();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data}));}
      catch{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:{message:'NetBird 연결을 확인하지 못했습니다.'}}));}return true;
    }
    if(path.startsWith('/vault/')){
      if(req.method!=='GET'){res.writeHead(405);res.end();return true;}
      const files={'/vault/':'public/index.html','/vault/index.html':'public/index.html','/vault/app.js':'public/app.js','/vault/device-client.mjs':'public/device-client.mjs','/vault/device-message.mjs':'public/device-message.mjs','/vault/operations.mjs':'public/operations.mjs','/vault/vendor/supabase.js':'public/vendor/supabase.js','/vault/sw.js':'public/sw.js','/vault/offline.html':'public/offline.html'};
      if(!files[path]){res.writeHead(404);res.end();return true;}
      let bytes=await readFile(new URL(files[path],root));
      if(path==='/vault/'||path.endsWith('index.html'))bytes=Buffer.from(bytes.toString('utf8').replace('src="/app.js"','src="/vault/app.js"').replace('src="/device-client.mjs"','src="/vault/device-client.mjs"').replace('src="/operations.mjs"','src="/vault/operations.mjs"').replace('src="/vendor/supabase.js"','src="/vault/vendor/supabase.js"'));
      if(path==='/vault/sw.js')bytes=Buffer.from(bytes.toString('utf8').replaceAll("'/offline.html'","'/vault/offline.html'"));
      res.writeHead(200,{'content-type':path.endsWith('.js')||path.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(bytes);return true;
    }
    if(path==='/auth-config.json'){
      const config=JSON.parse(await readFile(new URL('public/auth-config.json',root),'utf8'));
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(config));return true;
    }
    if(path==='/api/netbird/status'||path==='/api/netbird/restore'){
      try{
        let m;
        if(path.endsWith('/restore')){
          if(req.method!=='POST')throw Object.assign(Error(),{code:'REQUEST_INVALID'});
          const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1024)throw Error();chunks.push(chunk);}
          const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(Object.keys(input).length!==1||input.humanConfirmed!==true)throw Error();
          m=await control('restore',{humanConfirmed:true});
        }else{if(req.method!=='GET')throw Error();m=await context();}
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:true,data:m}));
      }catch(error){res.writeHead(409,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:false,error:safeError(error)}));}return true;
    }
    if(!['/api/auth','/api/device','/api/notes','/api/my/notes','/api/announcements','/api/restore','/notes','/my/notes','/announcements'].some(prefix=>path===prefix||path.startsWith(prefix+'/')))return false;
    try{
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000)throw Error('REQUEST_TOO_LARGE');chunks.push(chunk);}
      const input={method:req.method,path:canonicalTarget(req.url),headers:Object.fromEntries(['authorization','content-type','x-aleph-device','x-aleph-at','x-aleph-nonce','x-aleph-signature'].filter(k=>typeof req.headers[k]==='string').map(k=>[k,req.headers[k]])),body:Buffer.concat(chunks).toString('utf8')};validateVaultRequest(input);
      const generation=epoch,result=await transport('/agent/vault/relay',input);
      const query=new URL(input.path,'https://fixed.invalid');
      if(authorization===null&&generation===epoch&&typeof result.subjectId==='string'&&/^[a-f0-9-]{36}$/i.test(result.subjectId)
        &&/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.headers.authorization??'')){
        captureSession({status:200,data:{access_token:input.headers.authorization.slice(7)}});
        if(result.status<300&&!['/api/auth','/api/device'].includes(query.pathname)){approved=true;approvalExpires=0;}
      }
      if(query.pathname==='/api/auth'&&query.searchParams.get('path')==='token'&&result.status<300&&typeof result.data?.access_token==='string'){
        captureSession(result);
      }
      if(query.pathname==='/api/auth'&&query.searchParams.get('path')==='logout')clear();
      if(query.pathname==='/api/device'&&generation===epoch){
        const op=query.searchParams.get('operation');
        if(result.status<300&&['approve','status'].includes(op)){approved=result.data.approved===true;if(result.data.expiresAt)approvalExpires=Date.parse(result.data.expiresAt);}
        if(op==='revoke')approved=false;
      }
      res.writeHead(result.status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...result.headers});res.end(JSON.stringify(result.data));
    }catch(error){const e=safeError(error);res.writeHead(error.status??503,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:e.code,message:e.message}));}return true;
  }
  async function prepareExplanation(eventId,{signal}={}){
    const before=await context(signal),events=await engine.readEvents({subjectId:before.subjectId,projectId:PROJECT},{signal}),event=events.find(e=>e.id===eventId);
    if(!event)throw engineError('EVENT_NOT_FOUND','기존 자료실의 본인 기록이 아닙니다.',404);
    const contextHash=vaultDigest(before.context),eventHash=vaultDigest(event),ids=event.evidence.map(e=>e.id);
    const payload={eventId:event.id,summary:event.summary,evidence:event.evidence,rules:event.rules,observedState:event.state,currentState:{access:before.status.decision,session:before.status.session.state},supportedActions:event.target.generation===before.status.device.revision?event.supportedActions:[]};
    return {eventId,event,evidenceDigest:vaultDigest(payload),preview:payload,text:'실제 기존 자료실 기록을 한국어로 설명하세요. 과거 관측과 현재 상태를 구분하세요. 누락된 원천은 추측하지 마세요. JSON {"summary":"설명","evidenceIds":[모든 근거 id],"proposals":[{"action":"지원 목록의 조치","evidenceIds":[근거 id],"reason":"이유"}],"requiresHumanConfirmation":true,"executed":false}만 반환하세요. 제안은 최대 2개이며 자동 실행하지 않습니다.\n'+JSON.stringify(payload),
      async publish(value){
        const after=await context(signal),latest=(await engine.readEvents({subjectId:after.subjectId,projectId:PROJECT},{signal})).find(e=>e.id===eventId);
        if(vaultDigest(after.context)!==contextHash||!latest||vaultDigest(latest)!==eventHash)throw Object.assign(Error(),{code:'connection_changed'});
        let d;try{d=JSON.parse(value.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Object.assign(Error(),{code:'response_unverified'});}
        const refs=rows=>Array.isArray(rows)&&rows.length>0&&new Set(rows).size===rows.length&&rows.every(id=>ids.includes(id));
        if(!d||typeof d.summary!=='string'||d.summary.length>1500||!refs(d.evidenceIds)||d.evidenceIds.length!==ids.length||!Array.isArray(d.proposals)||d.proposals.length>2||d.proposals.some(p=>!payload.supportedActions.includes(p.action)||!refs(p.evidenceIds)||typeof p.reason!=='string')||d.requiresHumanConfirmation!==true||d.executed!==false)throw Object.assign(Error(),{code:'response_unverified'});
        return {eventId,eventDigest:eventHash,explanation:d};
      }};
  }
  return {engine,actionEngine,handle,control,prepareExplanation,resolveContext:async({signal}={})=>(await context(signal)).context};
}
