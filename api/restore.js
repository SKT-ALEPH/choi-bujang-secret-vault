import {productionRuntime} from './notes.js';
import {loadSafePolicy,SAFE_POLICY_HASH} from '../src/recovery-policy.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function createRestoreHandler(getRuntime = productionRuntime, getPolicy = loadSafePolicy) {
  return async function handler(request,response) {
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    if (!request.headers?.authorization) return response.status(401).json({error:'LOGIN_REQUIRED'});
    let services,identity;
    try {services=getRuntime();identity=await services.verifyLoginAuthorization(request.headers.authorization);}
    catch {return response.status(503).json({error:'AUTH_NOT_CONFIGURED'});}
    if (!identity) return response.status(401).json({error:'INVALID_LOGIN'});
    try {if(services.authorizeDevice&&!await services.authorizeDevice(request,identity))return response.status(403).json({error:'DEVICE_NOT_APPROVED'});}
    catch{return response.status(503).json({error:'DEVICE_SERVICE_UNAVAILABLE'});}
    if (request.method !== 'POST') {
      response.setHeader('Allow','POST');
      return response.status(405).json({error:'METHOD_NOT_ALLOWED'});
    }
    const id=request.query?.id;
    if (Object.keys(request.query ?? {}).some(k=>k!=='id')) return response.status(400).json({error:'RESOURCE_QUERY_NOT_ALLOWED'});
    if (typeof id !== 'string' || id.length !== 36 || !UUID.test(id)) return response.status(400).json({error:'INVALID_NOTE_ID'});
    let input=request.body;
    try {if(typeof input === 'string') input=JSON.parse(input);}
    catch {return response.status(400).json({error:'INVALID_RESTORE_INPUT'});}
    if (input != null && (typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some(k=>!['id','noteId'].includes(k))
        || ['id','noteId'].some(k=>input[k]!==undefined && input[k]!==id))) {
      return response.status(400).json({error:'INVALID_RESTORE_INPUT'});
    }
    let policy;
    try {policy=await getPolicy();if(policy.policyHash!==SAFE_POLICY_HASH)throw Error('invalid');}
    catch {return response.status(409).json({error:'BACKUP_VERIFICATION_FAILED'});}
    try {
      if (services.xdr) {
        const blocked=await services.xdr.check(request) ?? (services.xdr.inspect?await services.xdr.inspect(request,input):null);
        if(blocked) return response.status(403).json({error:'XDR_BLOCKED'});
      }
      const {data,error}=await services.database.rpc('restore_aleph_note',{
        p_actor:identity.userId,p_note:id,p_policy_hash:policy.policyHash,
      }).abortSignal(AbortSignal.timeout(10000));
      if(error) return response.status(error.code==='P0001'?409:502).json({error:error.code==='P0001'?'BACKUP_VERIFICATION_FAILED':'DATABASE_REQUEST_FAILED'});
      if(!Array.isArray(data)||data.length!==1) return response.status(404).json({error:'BACKUP_NOT_FOUND'});
      const row=data[0];
      if(row.verified!==true || row.note_id?.toLowerCase()!==id.toLowerCase()
          || row.owner_id?.toLowerCase()!==identity.userId.toLowerCase()
          || row.policy_sha256!==policy.policyHash || row.backup_version!==1
          || !/^[a-f0-9]{64}$/u.test(row.content_sha256)) {
        return response.status(409).json({error:'RESTORE_VERIFICATION_FAILED'});
      }
      return response.status(200).json({id:row.note_id,restored:true,contentHash:row.content_sha256,
        backupVersion:row.backup_version,policyVersion:policy.version,auditId:row.audit_id,
        verified:{id:true,owner:true,contentHash:true,policy:true}});
    } catch {return response.status(502).json({error:'DATABASE_REQUEST_FAILED'});}
  };
}
export default createRestoreHandler();
