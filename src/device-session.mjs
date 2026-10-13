import {createHash,createPublicKey,verify} from 'node:crypto';
import {requestMessage} from '../public/device-message.mjs';

export const fingerprint=value=>createHash('sha256').update(value).digest('hex');
export function verifyDeviceSignature(jwk,message,signature){
  try {
    if(typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/u.test(signature))return false;
    return verify('sha256',Buffer.from(message),{key:createPublicKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url'));
  }catch{return false;}
}
export function publicDeviceKey(input){
  if(!input||input.kty!=='EC'||input.crv!=='P-256'||'d' in input
      ||!['x','y'].every(k=>typeof input[k]==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(input[k])))throw Error('INVALID_DEVICE_KEY');
  const key={kty:'EC',crv:'P-256',x:input.x,y:input.y};createPublicKey({key,format:'jwk'});return key;
}
export async function authorizeDevice(database,request,identity){
  // Operator-signed test identities keep the original verifier/engine channel.
  // The supplied engine performs its own registration and request-signature checks.
  if(identity.kind==='judge')return true;
  const h=request.headers??{},id=h['x-aleph-device'],at=h['x-aleph-at'],nonce=h['x-aleph-nonce'];
  if(![id,nonce].every(v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(v))
      ||typeof at!=='string'||!/^\d{13}$/u.test(at)||Math.abs(Date.now()-Number(at))>30000)return false;
  const tokenHash=fingerprint(request.headers.authorization);
  const {data:device,error}=await database.from('aleph_device_sessions').select('public_jwk,token_hash,approved,expires_at')
    .eq('id',id).eq('user_id',identity.userId).maybeSingle().abortSignal(AbortSignal.timeout(10000));
  if(error||!device||!device.approved||device.token_hash!==tokenHash||Date.parse(device.expires_at)<=Date.now())return false;
  const url=new URL(request.url,'https://device.invalid');
  // Vercel may parse a bodyless GET/DELETE as {}; these methods carry no app body.
  const bodyless=['GET','HEAD'].includes(request.method)||(request.method==='DELETE'
    &&request.body&&typeof request.body==='object'&&Object.keys(request.body).length===0);
  const rawBody=bodyless?'':typeof request.body==='string'?request.body:request.body==null?'':JSON.stringify(request.body);
  const message=requestMessage({id,at,nonce,method:request.method,path:url.pathname+url.search,
    bodyHash:fingerprint(rawBody),tokenHash});
  if(!verifyDeviceSignature(device.public_jwk,message,h['x-aleph-signature']))return false;
  const used=await database.from('aleph_device_nonces').insert({device_id:id,nonce}).abortSignal(AbortSignal.timeout(10000));
  return !used.error;
}
