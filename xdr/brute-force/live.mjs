import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createDecider } from './decide.mjs';
import { createJevClient } from './jev.mjs';
import { createXdrGuard } from './guard.mjs';
import config from '../../aleph.config.json' with { type: 'json' };

// This context belongs to the HTTP server, not the 18-field class-engine request.
// Vercel overwrites this header at its edge. Other hosting needs its own adapter.
export function trustedVercelSource(request, isVercel = process.env.VERCEL === '1') {
  const source = request.headers?.['x-vercel-forwarded-for'];
  if (!isVercel || typeof source !== 'string' || !isIP(source)) throw new Error('XDR_SOURCE_UNAVAILABLE');
  return source;
}

export function createLiveXdr({ database, secret, getSource = trustedVercelSource,
  askJev = createJevClient({ enabled: true }), now = () => new Date().toISOString() }) {
  if (!secret) throw new Error('XDR_NOT_CONFIGURED');
  const digest = (kind,value) => createHmac('sha256',secret).update('xdr-01/'+kind+'/'+value).digest('hex');
  async function check(request) {
    const source=getSource(request);
    const {data,error}=await database.from('xdr_sources').select('created_at,expires_at,confidence,evidence_ids')
      .eq('source_key',digest('source',source)).maybeSingle().abortSignal(AbortSignal.timeout(10000));
    if(error)throw new Error('XDR_STORAGE_UNAVAILABLE');
    const guard=createXdrGuard(async req=>({schema:'aleph.decision.v1',requestId:req.requestId,
      decision:'allow',reasonCode:'approved',ruleIds:[]}),{
      getTrustedSource:async()=>source,getRules:async()=>data ? [{sourceAddress:source,action:'deny',
        createdAt:data.created_at,expiresAt:data.expires_at,confidence:data.confidence,evidenceAlertIds:data.evidence_ids}] : [],
      // Local HTTP policy codes; no claim that they are class-engine registrations.
      denyReasonCode:'xdr_brute_force',allowedReasonCodes:['approved','xdr_brute_force'],now,
    });
    const result=await guard({requestId:randomUUID()});
    return result.decision==='deny' ? {evidenceId:data.evidence_ids.at(-1),
      retryAfter:Math.max(1,Math.ceil((Date.parse(data.expires_at)-Date.parse(now()))/1000))} : null;
  }
  async function failure(request, input) {
    const source=getSource(request);
    const email=typeof input?.email==='string' ? input.email.trim().toLowerCase().slice(0,320) : '';
    const sourceKey=digest('source',source);
    const {data,error}=await database.rpc('xdr_failure',{p_source_key:sourceKey,p_account_key:digest('account',email)})
      .abortSignal(AbortSignal.timeout(10000));
    if(error || !data || !Number.isInteger(data.failureCount))throw new Error('XDR_STORAGE_UNAVAILABLE');
    const count=data.failureCount;
    const out=await createDecider({askJev})({timestamp:data.at,
      rule:{level:count>=20 ? 12 : count<=1 ? 3 : 6,
        description:`120초 안에 같은 주소에서 로그인 실패 ${count}건이 쌓였습니다.`},
      data:{srcip:source,srcuser:digest('account',email)}});
    const reason=out.reason.split(':')[0];
    const result=await database.rpc('xdr_apply',{p_source_key:sourceKey,p_window_started:data.windowStarted,
      p_alert_id:randomUUID(),p_action:out.action,p_confidence:out.confidence,p_reason:reason})
      .abortSignal(AbortSignal.timeout(10000));
    if(result.error)throw new Error('XDR_STORAGE_UNAVAILABLE');
    return out;
  }
  return {check,failure};
}

let runtime;
export function getLiveXdr() {
  if(runtime)return runtime;
  const url=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY?.trim();
  if(!url || !secret || url!==new URL(config.identityProvider.issuer).origin)throw new Error('XDR_NOT_CONFIGURED');
  const database=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(target,options)=>fetch(target,{...options,redirect:'error'})}});
  runtime=createLiveXdr({database,secret});return runtime;
}
