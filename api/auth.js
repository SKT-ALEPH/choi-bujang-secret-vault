import settings from '../config/supabase-public.json' with { type: 'json' };
import config from '../aleph.config.json' with { type: 'json' };

const routes = { token: ['POST'], signup: ['POST'], recover: ['POST'], user: ['GET', 'PUT'], logout: ['POST'] };

// Only Auth is proxied. The public credential never enters the browser bundle.
export function createAuthHandler(upstreamFetch = fetch) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const path = request.query?.path;
    if (typeof path !== 'string' || !routes[path]?.includes(request.method)) {
      return response.status(404).json({ error: 'AUTH_ROUTE_NOT_FOUND' });
    }
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
    if (['signup', 'recover'].includes(path)) target.searchParams.set('redirect_to', config.publicAppUrl + '/');
    if (path === 'logout') target.searchParams.set('scope', 'global');
    const authorization = request.headers?.authorization;
    const headers = { apikey: settings.publishableKey, 'Content-Type': 'application/json' };
    if (authorization && authorization !== 'Bearer auth-via-server') {
      if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/u.test(authorization)) {
        return response.status(401).json({ error: 'INVALID_LOGIN' });
      }
      headers.Authorization = authorization;
    }
    if (['user', 'logout'].includes(path) && !headers.Authorization) {
      return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    }
    let body;
    if (request.method !== 'GET') {
      body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
      if (Buffer.byteLength(body) > 16384) return response.status(413).json({ error: 'AUTH_INPUT_TOO_LARGE' });
    }
    try {
      const upstream = await upstreamFetch(target, { method: request.method, headers, body,
        redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (upstream.status === 204) return response.status(200).json({});
      const result = await upstream.json();
      // Forward sessions only to the caller; omit upstream diagnostics on errors.
      if (!upstream.ok) {
        const code = typeof result.error_code === 'string' ? result.error_code
          : typeof result.code === 'string' ? result.code : 'auth_failed';
        return response.status(upstream.status).json({ code, error_code: code, msg: '인증 요청에 실패했습니다.' });
      }
      return response.status(upstream.status).json(result);
    } catch {
      return response.status(502).json({ code: 'auth_unavailable', msg: '인증 서버에 연결하지 못했습니다.' });
    }
  };
}

export default createAuthHandler();
