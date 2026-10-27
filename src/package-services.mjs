import {productionRuntime} from '../api/notes.js';

export {productionRuntime};
// Reuse the original verified login and NetBird gateway boundary, never client user IDs.
export async function packageIdentity(request,response,getRuntime){
  response.setHeader('Cache-Control','no-store');
  response.setHeader('X-Content-Type-Options','nosniff');
  const auth=request.headers?.authorization;
  if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth)){
    response.status(401).json({error:'LOGIN_REQUIRED'});return null;
  }
  try{
    const services=getRuntime(),identity=await services.verifyLoginAuthorization(auth);
    if(!identity){response.status(401).json({error:'INVALID_LOGIN'});return null;}
    const blocked=await services.xdr?.check(request);
    if(blocked){response.status(403).json({error:'XDR_ACCESS_BLOCKED'});return null;}
    if(typeof services.authorizeGateway!=='function'||!await services.authorizeGateway(request)){
      response.status(403).json({error:'NETBIRD_GATEWAY_REQUIRED'});return null;
    }
    return {services,identity};
  }catch{response.status(503).json({error:'PACKAGE_AUTH_UNAVAILABLE'});return null;}
}

export function threatCache(database){
  return {
    async read(key){
      const {data,error}=await database.from('package_threat_cache').select('payload,fetched_at').eq('cache_key',key).maybeSingle().abortSignal(AbortSignal.timeout(5000));
      if(error)throw Error('THREAT_CACHE_UNAVAILABLE');return data;
    },
    async write(key,payload,fetchedAt){
      const {error}=await database.from('package_threat_cache').upsert({cache_key:key,payload,fetched_at:fetchedAt}).abortSignal(AbortSignal.timeout(5000));
      if(error)throw Error('THREAT_CACHE_UNAVAILABLE');
    },
  };
}
