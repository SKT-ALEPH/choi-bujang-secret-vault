import {createJevClient} from '../xdr/brute-force/jev.mjs';
import {packageIdentity,productionRuntime} from '../src/package-services.mjs';

const keys=['level','failureCount','accountCount','multiAccount','samePassword'];
export function createAiHandler({getRuntime=productionRuntime,ask=createJevClient({enabled:true}),dailyLimit=Number(process.env.PACKAGE_AI_DAILY_LIMIT??30),providerTimeoutMs=15000}={}){
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)throw Error('INVALID_DAILY_LIMIT');
  if(!Number.isInteger(providerTimeoutMs)||providerTimeoutMs<1||providerTimeoutMs>15000)throw Error('INVALID_PROVIDER_TIMEOUT');
  return async function handler(request,response){
    const auth=await packageIdentity(request,response,getRuntime);if(!auth)return;
    if(request.method!=='POST'){response.setHeader('Allow','POST');return response.status(405).json({error:'METHOD_NOT_ALLOWED'});}
    if(request.headers?.['content-type']?.split(';')[0]!=='application/json')return response.status(415).json({error:'JSON_REQUIRED'});
    if(Object.keys(request.query??{}).length)return response.status(400).json({error:'INVALID_AI_REQUEST'});
    let input=request.body;
    try{if(typeof input==='string')input=JSON.parse(input);}catch{}
    if(!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).length!==keys.length||!keys.every(k=>Object.hasOwn(input,k))
      ||!Number.isInteger(input.level)||input.level<0||input.level>16
      ||!Number.isInteger(input.failureCount)||input.failureCount<0||input.failureCount>1000000
      ||!Number.isInteger(input.accountCount)||input.accountCount<0||input.accountCount>10000
      ||typeof input.multiAccount!=='boolean'||typeof input.samePassword!=='boolean')return response.status(400).json({error:'INVALID_AI_REQUEST'});
    let quota;
    try{
      const {data,error}=await auth.services.database.rpc('package_reserve_ai_call',{p_user:auth.identity.userId,p_limit:dailyLimit}).abortSignal(AbortSignal.timeout(5000));
      quota=data;
      if(error||!quota||typeof quota.allowed!=='boolean'||![quota.used,quota.limit,quota.remaining].every(Number.isSafeInteger)
        ||quota.used<0||quota.allowed&&(quota.used<1||quota.used>dailyLimit)||quota.limit!==dailyLimit||quota.remaining!==Math.max(0,dailyLimit-quota.used)
        ||!Number.isFinite(Date.parse(quota.resetsAt)))throw Error();
    }catch{return response.status(503).json({error:'AI_QUOTA_UNAVAILABLE'});}
    if(!quota.allowed){
      response.setHeader('Retry-After',String(Math.max(1,Math.min(86400,Math.ceil((Date.parse(quota.resetsAt)-Date.now())/1000)))));
      return response.status(429).json({error:'AI_DAILY_LIMIT',quota});
    }
    // Reserve before transmission: ambiguous provider failures/cancellation must not bypass the cap.
    let confidence,timer;const controller=new AbortController();
    try{confidence=await Promise.race([Promise.resolve().then(()=>ask(input,{signal:controller.signal})),new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(null);},providerTimeoutMs);})]);}catch{}
    finally{clearTimeout(timer);}
    if(typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1)return response.status(502).json({error:'AI_PROVIDER_UNAVAILABLE',quota});
    const summary=`입력한 수치 요약에서 자동 대입 공격일 가능성에 대한 모델 확신도는 ${(confidence*100).toFixed(1)}%입니다. 원본 사건이나 실제 침해를 확인한 결과가 아니며 접근 판정·보안 조치는 실행하지 않았습니다.`;
    return response.status(200).json({ok:true,provider:'typesafe/jev-latest',inputScope:'numeric-authentication-summary',confidence,summary,quota,inferenceCompleted:true,actionExecuted:false,checkedAt:new Date().toISOString()});
  };
}
export default createAiHandler();
