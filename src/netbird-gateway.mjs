import {createHash,createPublicKey,sign,verify,randomUUID} from 'node:crypto';
import {canonicalTarget} from '../public/device-message.mjs';
import settings from '../config/netbird-gateway.json' with {type:'json'};

const hash=value=>createHash('sha256').update(value).digest('hex');
function canonicalBody(request){
  if(['GET','HEAD'].includes(request.method)||request.body==null)return '';
  if(request.method==='DELETE'&&typeof request.body==='object'&&Object.keys(request.body).length===0)return '';
  return typeof request.body==='string'?JSON.stringify(JSON.parse(request.body)):JSON.stringify(request.body);
}
function message(request,at,nonce){
  const h=request.headers??{};
  const policy=h['x-keshev-context']!==undefined?[h['x-keshev-request-id']??'',h['x-keshev-context'],h['x-keshev-max-records']??'']:[];
  return Buffer.from(JSON.stringify([policy.length?'keshev.netbird.gateway.v2':'keshev.netbird.gateway.v1',request.method,canonicalTarget(request.url),
    hash(canonicalBody(request)),hash(h.authorization??''),h['x-aleph-device']??'',h['x-aleph-at']??'',
    h['x-aleph-nonce']??'',h['x-aleph-signature']??'',at,nonce,...policy]));
}
export function signGatewayRequest(privateKey,request){
  const at=String(Date.now()),nonce=randomUUID();
  return {'x-keshev-gateway-at':at,'x-keshev-gateway-nonce':nonce,
    'x-keshev-gateway-signature':sign(null,message(request,at,nonce),privateKey).toString('base64')};
}
function verifiedGatewayKey(request,{required=settings.required,publicKey=settings.publicKey,publicKeys=publicKey===settings.publicKey?settings.publicKeys:undefined,centralPublicKeys=publicKey===settings.publicKey?settings.centralPublicKeys:[],centralRequiredPaths=publicKey===settings.publicKey?settings.centralRequiredPaths:[],clock=Date.now}={}){
  if(required!==true)return true;
  try{
    const h=request.headers??{},at=h['x-keshev-gateway-at'],nonce=h['x-keshev-gateway-nonce'],signature=h['x-keshev-gateway-signature'];
    if(typeof at!=='string'||!/^\d{13}$/.test(at)||Math.abs(clock()-Number(at))>30000
      ||typeof nonce!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)
      ||typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))return false;
    const target=new URL(canonicalTarget(request.url),'https://fixed.invalid').pathname;
    const candidates=(centralRequiredPaths??[]).includes(target)?centralPublicKeys??[]:publicKeys??[publicKey];
    // The existing device verifier consumes its signed nonce after this check.
    return candidates.find(pem=>{const key=createPublicKey(pem);return key.asymmetricKeyType==='ed25519'&&verify(null,message(request,at,nonce),key,Buffer.from(signature,'base64'));})??false;
  }catch{return false;}
}
export function verifyGatewayRequest(request,options){return Boolean(verifiedGatewayKey(request,options));}
export function gatewayRecordLimit(request){
  const h=request.headers??{};
  if(h['x-keshev-context']===undefined)return 100;
  if(!/^[a-f0-9]{64}$/.test(h['x-keshev-context'])||!/^[a-f0-9-]{36}$/.test(h['x-keshev-request-id']??'')
      ||!/^([1-9]|[1-9][0-9]|100)$/.test(h['x-keshev-max-records']??''))throw Error('INVALID_GATEWAY_POLICY');
  return Number(h['x-keshev-max-records']);
}
export async function authorizeGateway(database,request,options=settings){
  if(options.required!==true)return true;
  const key=verifiedGatewayKey(request,options);if(!key)return false;
  const {error}=await database.from('netbird_gateway_nonces').insert({nonce:request.headers['x-keshev-gateway-nonce']})
    .abortSignal(AbortSignal.timeout(10000));
  if(error)return false;
  request.keshevCentralGateway=(settings.centralPublicKeys??[]).includes(key);
  return true;
}
export function legacyXdrForGateway(xdr){
  return xdr?{check:request=>request.keshevCentralGateway?null:xdr.check(request),
    inspect:(request,input)=>request.keshevCentralGateway?null:xdr.inspect?.(request,input),
    failure:(request,input)=>request.keshevCentralGateway?null:xdr.failure?.(request,input)}:null;
}
