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
  return Buffer.from(JSON.stringify(['keshev.netbird.gateway.v1',request.method,canonicalTarget(request.url),
    hash(canonicalBody(request)),hash(h.authorization??''),h['x-aleph-device']??'',h['x-aleph-at']??'',
    h['x-aleph-nonce']??'',h['x-aleph-signature']??'',at,nonce]));
}
export function signGatewayRequest(privateKey,request){
  const at=String(Date.now()),nonce=randomUUID();
  return {'x-keshev-gateway-at':at,'x-keshev-gateway-nonce':nonce,
    'x-keshev-gateway-signature':sign(null,message(request,at,nonce),privateKey).toString('base64')};
}
export function verifyGatewayRequest(request,{required=settings.required,publicKey=settings.publicKey,clock=Date.now}={}){
  if(required!==true)return true;
  try{
    const h=request.headers??{},at=h['x-keshev-gateway-at'],nonce=h['x-keshev-gateway-nonce'],signature=h['x-keshev-gateway-signature'];
    if(typeof at!=='string'||!/^\d{13}$/.test(at)||Math.abs(clock()-Number(at))>30000
      ||typeof nonce!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(nonce)
      ||typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))return false;
    const key=createPublicKey(publicKey);if(key.asymmetricKeyType!=='ed25519')return false;
    // The existing device verifier consumes its signed nonce after this check.
    return verify(null,message(request,at,nonce),key,Buffer.from(signature,'base64'));
  }catch{return false;}
}
export async function authorizeGateway(database,request,options=settings){
  if(options.required!==true)return true;
  if(!verifyGatewayRequest(request,options))return false;
  const {error}=await database.from('netbird_gateway_nonces').insert({nonce:request.headers['x-keshev-gateway-nonce']})
    .abortSignal(AbortSignal.timeout(10000));
  return !error;
}
