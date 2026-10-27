import {productionRuntime} from './notes.js';
import {fingerprint,verifyDeviceSignature} from '../src/device-session.mjs';
import {requestMessage} from '../public/device-message.mjs';
import {uuid,exact} from '../server-security/common.mjs';

export function createGatewayContextHandler(getRuntime=productionRuntime){return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  if(req.method!=='POST'||Object.keys(req.query??{}).length)return res.status(400).json({error:'INVALID_CONTEXT_REQUEST'});
  try{
    const s=getRuntime();
    if(!await s.authorizeGateway(req))return res.status(403).json({error:'NETBIRD_GATEWAY_REQUIRED'});
    const identity=await s.verifyLoginAuthorization(req.headers.authorization);
    if(!identity||identity.kind!=='student')return res.status(401).json({error:'INVALID_LOGIN'});
    let x=req.body;if(typeof x==='string')x=JSON.parse(x);
    if(!exact(x,['method','path','bodyHash','deviceProof'])||!['GET','POST','PUT','DELETE'].includes(x.method)||typeof x.path!=='string'||x.path.length>2048||!/^[a-f0-9]{64}$/.test(x.bodyHash))return res.status(400).json({error:'INVALID_CONTEXT_REQUEST'});
    const u=new URL(x.path,'https://fixed.invalid'),d=x.deviceProof;
    if(u.origin!=='https://fixed.invalid'||u.hash||u.pathname.includes('%')||!['/api/notes','/api/my/notes','/api/announcements','/api/restore'].includes(u.pathname)
      ||[...u.searchParams.keys()].some(k=>k!=='id')||u.searchParams.getAll('id').length>1||!exact(d,['id','at','nonce','signature'])||!uuid(d.id)||!uuid(d.nonce)
      ||typeof d.at!=='string'||!/^\d{13}$/.test(d.at)||Math.abs(Date.now()-Number(d.at))>30000)return res.status(400).json({error:'INVALID_CONTEXT_REQUEST'});
    const {data:device,error}=await s.database.from('aleph_device_sessions').select('public_jwk,token_hash,approved,expires_at').eq('id',d.id).eq('user_id',identity.userId).maybeSingle().abortSignal(AbortSignal.timeout(5000));
    if(error)throw Error('DB');
    if(!device||!device.approved||device.token_hash!==fingerprint(req.headers.authorization)||Date.parse(device.expires_at)<=Date.now()
      ||!verifyDeviceSignature(device.public_jwk,requestMessage({id:d.id,at:d.at,nonce:d.nonce,method:x.method,path:x.path,bodyHash:x.bodyHash,tokenHash:fingerprint(req.headers.authorization)}),d.signature))return res.status(403).json({error:'DEVICE_NOT_APPROVED'});
    // Inspect current metadata without consuming the original device nonce or reading note text.
    const id=u.searchParams.get('id');
    if(id&&!uuid(id))return res.status(400).json({error:'INVALID_NOTE_ID'});
    if(u.pathname==='/api/announcements'&&x.method!=='GET'){
      if(x.method!=='PUT'||!id)return res.status(403).json({error:'RESOURCE_NOT_AUTHORIZED'});
      const grant=await s.database.from('announcement_editors').select('announcement_id').eq('user_id',identity.userId).eq('announcement_id',id).maybeSingle().abortSignal(AbortSignal.timeout(5000));
      if(grant.error)throw Error('DB');if(!grant.data)return res.status(403).json({error:'RESOURCE_NOT_AUTHORIZED'});
    }
    if(u.pathname==='/api/restore'&&(x.method!=='POST'||!id))return res.status(400).json({error:'INVALID_RESTORE_REQUEST'});
    // Backup restoration is the existing own-backup operation, distinct from lifting a security block.
    // The existing restore RPC binds its actor to this verified identity and checks private backup ownership.
    if(id&&!['/api/announcements','/api/restore'].includes(u.pathname)){
      const own=await s.database.from('notes').select('id').eq('id',id).eq('owner_id',identity.userId).maybeSingle().abortSignal(AbortSignal.timeout(5000));
      if(own.error)throw Error('DB');if(!own.data)return res.status(403).json({error:'RESOURCE_NOT_AUTHORIZED'});
    }
    const claims=JSON.parse(Buffer.from(req.headers.authorization.slice(7).split('.')[1],'base64url'));
    const tokenHash=fingerprint(req.headers.authorization);
    return res.status(200).json({schema:'keshev.gateway.context.v1',subjectId:identity.userId,sessionId:claims.session_id??tokenHash,deviceCredentialId:d.id,
      resource:u.pathname+(id?'/'+id:''),operation:x.method,stepUp:claims.aal==='aal2',expiresAt:device.expires_at,
      stateVersion:fingerprint(JSON.stringify([device.approved,device.token_hash,device.expires_at,id??null]))});
  }catch{return res.status(503).json({error:'CONTEXT_UNAVAILABLE'});}
};}
export default createGatewayContextHandler();
