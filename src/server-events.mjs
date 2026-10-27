import {randomUUID} from 'node:crypto';
import {keyFromSecret,packet,publicPem,sha} from '../server-security/common.mjs';

export function webEventKey(secret=process.env.SUPABASE_SECRET_KEY){if(!secret)throw Error('WEB_EVENT_KEY_UNAVAILABLE');return keyFromSecret(secret);}
export function webEventPublicKey(){return publicPem(webEventKey());}
export function withWebEvent(handler,{key=()=>webEventKey()}={}){return async(req,res)=>{
  const json=res.json.bind(res);
  res.json=value=>{
    if(req.keshevIdentity&&req.headers['x-keshev-context']){
      const event={schema:'keshev.web.event.v1',eventId:randomUUID(),requestId:req.headers['x-keshev-request-id'],contextDigest:req.headers['x-keshev-context'],
        subjectId:req.keshevIdentity.userId,status:res.statusCode,records:Array.isArray(value)?value.length:value?.id?1:0,bytes:Buffer.byteLength(JSON.stringify(value)),responseDigest:sha(JSON.stringify(value)),observedAt:new Date().toISOString()};
      const signed=packet(key(),'web-event',event);
      res.setHeader('X-Keshev-Web-Event',Buffer.from(JSON.stringify(signed)).toString('base64url'));
    }
    return json(value);
  };
  return handler(req,res);
};}
