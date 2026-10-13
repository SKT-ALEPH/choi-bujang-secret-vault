import {randomUUID,randomBytes} from 'node:crypto';
import {productionRuntime} from './notes.js';
import {authorizeDevice,fingerprint,publicDeviceKey,verifyDeviceSignature} from '../src/device-session.mjs';
import {enrollmentMessage} from '../public/device-message.mjs';

export function createDeviceHandler(getRuntime=productionRuntime){return async function(request,response){
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  if(!request.headers?.authorization)return response.status(401).json({error:'LOGIN_REQUIRED'});
  let services,identity;
  try{services=getRuntime();identity=await services.verifyLoginAuthorization(request.headers.authorization);}
  catch{return response.status(503).json({error:'AUTH_NOT_CONFIGURED'});}
  if(!identity)return response.status(401).json({error:'INVALID_LOGIN'});
  const operation=request.query?.operation;
  if(Object.keys(request.query??{}).some(k=>k!=='operation')||!['status','request','approve','revoke'].includes(operation))return response.status(400).json({error:'INVALID_DEVICE_OPERATION'});
  if(request.method!==(operation==='status'?'GET':'POST'))return response.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const {database}=services,tokenHash=fingerprint(request.headers.authorization);
  try{
    if(operation==='status')return response.status(200).json({approved:await authorizeDevice(database,request,identity),policy:'authenticated_session_key',persistent:false});
    if(identity.kind!=='student')return response.status(403).json({error:'DEVICE_ENROLLMENT_NOT_AVAILABLE'});
    let input=request.body;try{if(typeof input==='string')input=JSON.parse(input);}catch{return response.status(400).json({error:'INVALID_DEVICE_INPUT'});}
    if(operation==='request'){
      if(!input||Object.keys(input).some(k=>k!=='publicKey'))return response.status(400).json({error:'INVALID_DEVICE_INPUT'});
      let key;try{key=publicDeviceKey(input.publicKey);}catch{return response.status(400).json({error:'INVALID_DEVICE_KEY'});}
      const active=await database.from('aleph_device_sessions').select('id',{count:'exact',head:true}).eq('user_id',identity.userId).gt('expires_at',new Date().toISOString());
      if(active.error)throw Error('DB');if(active.count>=5)return response.status(429).json({error:'DEVICE_SESSION_LIMIT'});
      const id=randomUUID(),challenge=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+120000).toISOString();
      const saved=await database.from('aleph_device_sessions').insert({id,user_id:identity.userId,public_jwk:key,token_hash:tokenHash,challenge,expires_at:expiresAt});
      if(saved.error)throw Error('DB');return response.status(201).json({id,challenge,expiresAt,approved:false});
    }
    if(operation==='revoke'){
      if(!await authorizeDevice(database,request,identity))return response.status(403).json({error:'DEVICE_NOT_APPROVED'});
      const saved=await database.from('aleph_device_sessions').update({approved:false,expires_at:new Date().toISOString()}).eq('id',request.headers['x-aleph-device']).eq('user_id',identity.userId);
      if(saved.error)throw Error('DB');return response.status(200).json({approved:false});
    }
    if(!input||Object.keys(input).some(k=>!['id','signature'].includes(k))||typeof input.id!=='string'||input.id.length!==36)return response.status(400).json({error:'INVALID_DEVICE_INPUT'});
    const {data:device,error}=await database.from('aleph_device_sessions').select('*').eq('id',input.id).eq('user_id',identity.userId).eq('approved',false).maybeSingle();
    if(error)throw Error('DB');
    if(!device||device.token_hash!==tokenHash||Date.parse(device.expires_at)<=Date.now()
      ||!verifyDeviceSignature(device.public_jwk,enrollmentMessage(device.id,device.challenge,tokenHash),input.signature))return response.status(403).json({error:'DEVICE_PROOF_INVALID'});
    const expiresAt=new Date(Date.now()+3600000).toISOString();
    const saved=await database.from('aleph_device_sessions').update({approved:true,challenge:null,expires_at:expiresAt}).eq('id',device.id).eq('user_id',identity.userId).eq('approved',false).select('id');
    if(saved.error||saved.data?.length!==1)return response.status(409).json({error:'DEVICE_REQUEST_CHANGED'});
    return response.status(200).json({approved:true,expiresAt,policy:'authenticated_session_key',persistent:false});
  }catch{return response.status(503).json({error:'DEVICE_SERVICE_UNAVAILABLE'});}
};}
export default createDeviceHandler();
