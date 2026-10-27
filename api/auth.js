import settings from '../config/supabase-public.json' with { type: 'json' };
import config from '../aleph.config.json' with { type: 'json' };
import { getLiveXdr } from '../xdr/live.mjs';
import {productionRuntime} from './notes.js';

const routes = { token: ['POST'], signup: ['POST'], recover: ['POST'], otp:['POST'], verify:['POST'], user: ['GET', 'PUT'], logout: ['POST'] };

// Only Auth is proxied. The public credential never enters the browser bundle.
export function createAuthHandler(upstreamFetch = fetch, { getXdr = () => null, getGateway = () => null, getPublishableKey=()=>process.env.SUPABASE_PUBLISHABLE_KEY } = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const path = request.query?.path;
    if (typeof path !== 'string' || !routes[path]?.includes(request.method)) {
      return response.status(404).json({ error: 'AUTH_ROUTE_NOT_FOUND' });
    }
    try{const gateway=getGateway();if(gateway&&!await gateway(request))return response.status(403).json({code:'netbird_gateway_required',error_code:'netbird_gateway_required',msg:'NetBird로 연결된 케셰브에서 자료실을 여세요.'});}
    catch{return response.status(503).json({code:'gateway_unavailable',msg:'사설 연결 확인에 실패했습니다.'});}
    const target = new URL('/auth/v1/' + path, settings.url);
    if (target.origin !== new URL(config.identityProvider.issuer).origin) {
      return response.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });
    }
    if (path === 'token') {
      const grant = request.query?.grant_type;
      if (!['password', 'refresh_token'].includes(grant)) return response.status(400).json({ error: 'INVALID_GRANT' });
      target.searchParams.set('grant_type', grant);
    }
    // Redirects may only return to this app, never an arbitrary destination.
    if (['signup', 'recover','otp'].includes(path)) target.searchParams.set('redirect_to', config.publicAppUrl + '/');
    if (path === 'logout') target.searchParams.set('scope', 'global');
    const authorization = request.headers?.authorization;
    const headers = { 'Content-Type': 'application/json' };
    if (authorization && authorization !== 'Bearer auth-via-server') {
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/u.test(authorization)) {
        return response.status(401).json({ error: 'INVALID_LOGIN' });
      }
      headers.Authorization = authorization;
    }
    if (['user', 'logout'].includes(path) && !headers.Authorization) {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    const publishableKey=getPublishableKey();
    if(typeof publishableKey!=='string'||!publishableKey.trim()||publishableKey!==publishableKey.trim())return response.status(503).json({error:'AUTH_NOT_CONFIGURED'});
    headers.apikey=publishableKey;
    let body;
    if (request.method !== 'GET') {
      body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
      if (Buffer.byteLength(body) > 16384) return response.status(413).json({ error: 'AUTH_INPUT_TOO_LARGE' });
    }
    try {
      const xdr=getXdr();
      if(xdr && path!=='logout') {
        const blocked=await xdr.check(request) ?? (xdr.inspect ? await xdr.inspect(request) : null);
        if(blocked) {
          response.setHeader('Retry-After',String(blocked.retryAfter));
          response.setHeader('X-XDR-Evidence',blocked.evidenceId);
          return response.status(429).json({code:blocked.code ?? 'xdr_brute_force',error_code:blocked.code ?? 'xdr_brute_force',msg:'반복 공격 신호로 잠시 차단되었습니다.'});
        }
      }
      const upstream = await upstreamFetch(target, { method: request.method, headers, body,
        redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (upstream.status === 204) return response.status(200).json({});
      const result = await upstream.json();
      // Forward sessions only to the caller; omit upstream diagnostics on errors.
      if (!upstream.ok) {
        const code = typeof result.error_code === 'string' ? result.error_code
          : typeof result.code === 'string' ? result.code : 'auth_failed';
        if(xdr && path==='token' && request.query?.grant_type==='password' && code==='invalid_credentials') {
          let input;try{input=JSON.parse(body);}catch{input={};}
          await xdr.failure(request,input);
        }
        return response.status(upstream.status).json({ code, error_code: code, msg: '인증 요청에 실패했습니다.' });
      }
      return response.status(upstream.status).json(result);
    } catch {
      return response.status(502).json({ code: 'auth_unavailable', msg: '인증 서버에 연결하지 못했습니다.' });
    }
  };
}

export default createAuthHandler(fetch,{getXdr:getLiveXdr,getGateway:()=>productionRuntime().authorizeGateway});
