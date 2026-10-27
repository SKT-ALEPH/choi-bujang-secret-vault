import {packageIdentity,productionRuntime,threatCache} from '../src/package-services.mjs';
import {COMPONENTS,createThreatIntelReader} from '../src/threat-intel.mjs';
const readers=new WeakMap();
export function createThreatIntelHandler({getRuntime=productionRuntime,read}={}){
  return async function handler(request,response){
    const auth=await packageIdentity(request,response,getRuntime);if(!auth)return;
    if(request.method!=='GET'){response.setHeader('Allow','GET');return response.status(405).json({error:'METHOD_NOT_ALLOWED'});}
    const keys=Object.keys(request.query??{}),component=request.query?.component??'node',page=request.query?.page??'0';
    if(keys.some(k=>!['component','page'].includes(k))||typeof component!=='string'||!Object.hasOwn(COMPONENTS,component)||typeof page!=='string'||! /^(?:0|[1-9]\d?)$/.test(page)||Number(page)>39)return response.status(400).json({error:'THREAT_COMPONENT_INVALID'});
    try{
      if(!readers.has(auth.services))readers.set(auth.services,createThreatIntelReader({cache:threatCache(auth.services.database)}));
      const data=await (read??readers.get(auth.services))(component,Number(page));
      return response.status(200).json({ok:true,data});
    }catch(error){
      const code=['THREAT_SOURCE_RATE_LIMITED','THREAT_SOURCE_UNAVAILABLE','THREAT_SOURCE_INVALID','THREAT_SOURCE_TOO_LARGE','THREAT_CACHE_UNAVAILABLE'].includes(error.code??error.message)?error.code??error.message:'THREAT_INTEL_UNAVAILABLE';
      if(code==='THREAT_SOURCE_RATE_LIMITED')response.setHeader('Retry-After','30');
      return response.status(code==='THREAT_SOURCE_RATE_LIMITED'?429:503).json({error:code});
    }
  };
}
export default createThreatIntelHandler();
