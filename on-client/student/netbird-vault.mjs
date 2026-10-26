import {createHash,createPublicKey} from 'node:crypto';
import {signGatewayRequest} from '../../src/netbird-gateway.mjs';
import config from '../../aleph.config.json' with {type:'json'};
import {projectVaultEvent,vaultContext} from './netbird-events.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const fault=(code,status=409)=>Object.assign(Error(code),{code,status});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const headerNames=['authorization','content-type','x-aleph-device','x-aleph-at','x-aleph-nonce','x-aleph-signature'];
export function validateVaultRequest(input){
  if(!exact(input,['method','path','headers','body'])||!['GET','POST','PUT','DELETE'].includes(input.method)
    ||typeof input.path!=='string'||input.path.length>2048||typeof input.body!=='string'||Buffer.byteLength(input.body)>20000
    ||!input.headers||Array.isArray(input.headers)||Object.keys(input.headers).some(k=>!headerNames.includes(k))
    ||Object.values(input.headers).some(v=>typeof v!=='string'||v.length>8192||/[\r\n]/.test(v)))throw fault('VAULT_REQUEST_INVALID',400);
  const url=new URL(input.path,'https://fixed.invalid');
  if(url.origin!=='https://fixed.invalid'||url.hash||url.pathname.includes('%')||!input.path.startsWith('/api/'))throw fault('VAULT_REQUEST_INVALID',400);
  if(url.pathname==='/api/auth'){
    const auth={token:['POST'],signup:['POST'],recover:['POST'],otp:['POST'],verify:['POST'],user:['GET','PUT'],logout:['POST']},path=url.searchParams.get('path');
    if(!auth[path]?.includes(input.method)||[...url.searchParams.keys()].some(k=>!['path','grant_type','redirect_to','scope'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1))throw fault('VAULT_REQUEST_INVALID',400);
  }else if(url.pathname==='/api/device'){
    const op=url.searchParams.get('operation');
    if(!['status','request','approve','revoke'].includes(op)||input.method!==(op==='status'?'GET':'POST')||[...url.searchParams.keys()].some(k=>k!=='operation'))throw fault('VAULT_REQUEST_INVALID',400);
  }else{
    const allowed={'/api/notes':['GET','POST','PUT','DELETE'],'/api/my/notes':['GET'],'/api/announcements':['GET','PUT'],'/api/restore':['POST']};
    if(!allowed[url.pathname]?.includes(input.method)||[...url.searchParams.keys()].some(k=>k!=='id')||url.searchParams.getAll('id').length>1)throw fault('VAULT_REQUEST_INVALID',400);
  }
  if(['GET','DELETE'].includes(input.method)&&input.body!=='')throw fault('VAULT_REQUEST_INVALID',400);
  return url.pathname+url.search;
}
function tokenSession(authorization){
  const v=sha(authorization),s=v.slice(0,12)+'4'+v.slice(13,16)+'8'+v.slice(17,32);
  return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');
}
export function createVaultGateway({privateKey,deviceId,store,origin=config.publicAppUrl,request=fetch}){
  if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw Error('VAULT_ORIGIN_INVALID');
  const identities=new Map();
  const engineGeneration=parseInt(sha(createPublicKey(privateKey).export({type:'spki',format:'pem'})).slice(0,12),16)||1;
  async function fetchVault(path,method,headers,body){
    const proof=signGatewayRequest(privateKey,{method,url:path,headers,body:body||undefined});
    let r;try{r=await request(origin+path,{method,headers:{...headers,...proof},body:['GET','HEAD'].includes(method)?undefined:body||undefined,redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw fault('VAULT_UNAVAILABLE',503);}
    const chunks=[];let size=0;const reader=r.body?.getReader();if(!reader)throw fault('VAULT_RESPONSE_INVALID',503);
    try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>2*1024*1024)throw fault('VAULT_RESPONSE_INVALID',503);chunks.push(p.value);}}finally{await reader.cancel();}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault('VAULT_RESPONSE_INVALID',503);}
    return {status:r.status,data,headers:Object.fromEntries(['retry-after','x-xdr-evidence','x-resource-id'].map(k=>[k,r.headers.get(k)]).filter(([,v])=>typeof v==='string'&&v.length<300&&!/[\r\n]/.test(v)))};
  }
  async function principal(authorization){
    if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)||authorization.length>8192)throw fault('VAULT_SIGN_IN_REQUIRED',401);
    const hash=sha(authorization);let current=identities.get(hash);
    if(!current||current.until<=Date.now()){
      const r=await fetchVault('/api/auth?path=user','GET',{authorization,'content-type':'application/json'},'');
      if(r.status!==200||!uuid(r.data?.id))throw fault(r.status===401?'VAULT_SIGN_IN_REQUIRED':'VAULT_IDENTITY_UNAVAILABLE',r.status===401?401:503);
      let exp;try{exp=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url')).exp;}catch{}
      if(!Number.isSafeInteger(exp)||exp*1000<=Date.now())throw fault('VAULT_SIGN_IN_REQUIRED',401);
      current={subjectId:r.data.id,until:Math.min(exp*1000,Date.now()+15*60000)};identities.set(hash,current);
    }
    const actor={owner:'owner-'+sha('supabase:'+current.subjectId).slice(0,48),device:deviceId,session:tokenSession(authorization)};
    store.route('/agent/session',{actor,input:{}});
    return {actor,subjectId:current.subjectId};
  }
  async function relay(input){
    const path=validateVaultRequest(input),auth=new URL(path,'https://fixed.invalid').pathname==='/api/auth';
    const who=input.headers.authorization?.startsWith('Bearer ')&&input.headers.authorization!=='Bearer auth-via-server'&&!auth?await principal(input.headers.authorization):null;
    if(!auth&&!who)throw fault('VAULT_SIGN_IN_REQUIRED',401);
    const enrollment=path.startsWith('/api/device?');
    if(who&&!enrollment)store.requireAccess(who.actor);
    const headers={...input.headers};
    const result=await fetchVault(path,input.method,headers,input.body);
    if(who){
      const kind=result.headers['x-xdr-evidence']?'xdr':'access',blocked=result.status===401||result.status===403||result.status===429;
      const code=typeof result.data?.error==='string'&&/^[A-Z0-9_]{1,80}$/.test(result.data.error)?result.data.error:'VAULT_HTTP_'+result.status;
      store.audit(who.actor,{appId:'vault',kind,summary:kind==='xdr'?'기존 자료실 XDR가 요청을 차단했습니다.':result.status<300?'기존 자료실의 요청을 처리했습니다.':blocked?'기존 자료실에서 요청이 거부됐습니다.':'기존 자료실 요청을 끝까지 확인하지 못했습니다.',
        access:result.status<300?'allowed':blocked?'denied':'unknown',rule:kind==='xdr'?code:'EXISTING_VAULT_AUTHORIZATION',actions:['device:revoke','grant:remove'],
        source:'NetBird Windows 게이트웨이 → 기존 Vercel 자료실의 실제 HTTP 응답',
        evidence:[{id:'http',text:`${input.method} ${path.split('?')[0]} · HTTP ${result.status}`},...(kind==='xdr'?[{id:'upstream-evidence',text:result.headers['x-xdr-evidence']}]:[])]});
    }
    return {...result,subjectId:who?.subjectId??null};
  }
  async function control(input){
    if(!exact(input,['authorization','operation','input']))throw fault('VAULT_REQUEST_INVALID',400);
    const who=await principal(input.authorization),{actor,subjectId}=who;
    const status=store.route('/agent/status',{actor,input:{}}),context=vaultContext(status,subjectId,engineGeneration);
    if(input.operation==='context')return {context,status,subjectId};
    if(input.operation==='actionEvents')return store.route('/agent/events',{actor,input:{}}).events.map(e=>projectVaultEvent(e,subjectId,{action:true}));
    if(input.operation==='authorizeCommand'){
      const command=input.input;
      return {allowed:store.authorizeCommand(actor,command,subjectId,engineGeneration),durableOperations:true,context,eventId:command.eventId,actionId:command.actionId,target:command.target,snapshotDigest:command.snapshotDigest};
    }
    if(input.operation==='executeCommand')return store.executeCommand(actor,input.input,subjectId,engineGeneration);
    if(input.operation==='readCommand')return store.readCommand(actor,input.input.requestId);
    const routes={status:'/agent/status',events:'/agent/events',receipts:'/agent/receipts',access:'/agent/access',prepare:'/agent/action/prepare',execute:'/agent/action/execute',result:'/agent/action/result',restore:'/agent/restore',logout:'/agent/logout',pc:'/agent/pc'};
    if(!Object.hasOwn(routes,input.operation))throw fault('VAULT_REQUEST_INVALID',400);
    return {subjectId,projectId:'choi-bujang-secret-vault',...store.route(routes[input.operation],{actor,input:input.input})};
  }
  return {relay,control,publicKey:createPublicKey(privateKey).export({type:'spki',format:'pem'})};
}
