import {runFixedCheck,operationsReport} from '../src/operations.mjs';

// Public, read-only diagnostics: fixed synthetic tests and redacted test receipts only.
// No credentials, arbitrary subjects, resource selection or database access.
export default async function handler(request,response){
 response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
 if(request.method!=='GET')return response.status(405).json({error:'METHOD_NOT_ALLOWED'});
 if(Object.keys(request.query??{}).some(k=>k!=='case')||request.query?.case!==undefined&&typeof request.query.case!=='string')return response.status(400).json({error:'INVALID_CHECK'});
 try{
  const result=request.query?.case===undefined?await operationsReport():await runFixedCheck(request.query.case);
  if(!result)return response.status(400).json({error:'UNKNOWN_CHECK'});
  response.setHeader('X-Request-ID',result.requestId);return response.status(200).json(result);
 }catch{return response.status(503).json({error:'CHECKS_UNAVAILABLE'});}
}
