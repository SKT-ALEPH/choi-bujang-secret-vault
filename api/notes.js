import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import config from '../aleph.config.json' with { type: 'json' };
import { getLiveXdr } from '../xdr/live.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const fields = 'id,title,content';
const publicNote = ({ id, title, content }) => ({ id, title, body: content });
let runtime;
function productionRuntime() {
  if (runtime) return runtime;
  const projectUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!projectUrl || !secretKey || projectUrl !== new URL(config.identityProvider.issuer).origin) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  const database = createClient(projectUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (target, options) => fetch(target, { ...options, redirect: 'error' }) },
  });
  runtime = { database, xdr:getLiveXdr(), verifyLoginAuthorization: createLoginVerifier({ config, supabaseSecretKey: secretKey }) };
  return runtime;
}

export function createNotesHandler(getRuntime = productionRuntime) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const authorization = request.headers?.authorization;
    if (!authorization) return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    let database, identity, xdr;
    try {
      const services = getRuntime();
      database = services.database;
      xdr=services.xdr;
      identity = await services.verifyLoginAuthorization(authorization);
    } catch {
      return response.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });
    }
    if (!identity) return response.status(401).json({ error: 'INVALID_LOGIN' });
    const method = request.method;
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      response.setHeader('Allow', 'GET, POST, PUT, DELETE');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    let preview;
    if (method === 'POST' || method === 'PUT') { try { preview = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; } catch {} }
    try {
      if(xdr) {
        const blocked=await xdr.check(request) ?? (xdr.inspect ? await xdr.inspect(request, preview) : null);
        if(blocked) {
          response.setHeader('Retry-After',String(blocked.retryAfter));
          response.setHeader('X-XDR-Evidence',blocked.evidenceId);
          return response.status(403).json({error:blocked.code === 'xdr_web_injection' ? 'XDR_WEB_INJECTION' : 'XDR_BRUTE_FORCE'});
        }
      }
    } catch { return response.status(502).json({error:'DATABASE_REQUEST_FAILED'}); }
    const id = request.query?.id;
    if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) {
      return response.status(400).json({ error: 'INVALID_NOTE_ID' });
    }
    if ((method === 'PUT' || method === 'DELETE') && !id) {
      return response.status(400).json({ error: 'NOTE_ID_REQUIRED' });
    }
    if (method === 'POST' && id) return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    let input;
    if (method === 'POST' || method === 'PUT') {
      try { input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; } catch { /* Invalid JSON is rejected below. */ }
      if (input && (Object.hasOwn(input, 'owner_id') || Object.hasOwn(input, 'ownerId'))) {
        return response.status(400).json({ error: 'OWNER_IMMUTABLE' });
      }
      if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
          || typeof input.body !== 'string' || input.body.length > 10000
          || (method === 'POST' && input.id !== undefined && (typeof input.id !== 'string' || !UUID.test(input.id)))) {
        return response.status(400).json({ error: 'INVALID_NOTE' });
      }
    }
    try {
      let query;
      if (method === 'GET') {
        query = database.from('notes').select(fields);
        query = id ? query.eq('id', id).eq('owner_id', identity.userId).maybeSingle()
          : query.eq('owner_id', identity.userId).order('id').limit(100);
      } else if (method === 'POST') {
        query = database.from('notes').insert({ id: input.id ?? randomUUID(),
          title: input.title.trim(), content: input.body, owner_id: identity.userId }).select('id').single();
      } else if (method === 'PUT') {
        // Match ownership in the same database statement; the owner remains unchanged.
        query = database.from('notes').update({ title: input.title.trim(), content: input.body })
          .eq('id', id).eq('owner_id', identity.userId).select(fields).maybeSingle();
      } else {
        query = database.from('notes').delete().eq('id', id).eq('owner_id', identity.userId).select('id').maybeSingle();
      }
      const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
      if (error) return response.status(error.code === '23505' ? 409 : 502)
        .json({ error: error.code === '23505' ? 'NOTE_ID_EXISTS' : 'DATABASE_REQUEST_FAILED' });
      if (id && !data) return response.status(404).json({ error: 'NOTE_NOT_FOUND' });
      if (method === 'POST') return response.status(201).json({ id: data.id });
      if (method === 'DELETE') return response.status(200).json({ id: data.id, deleted: true });
      return response.status(200).json(id ? publicNote(data) : data.map(publicNote));
    } catch {
      return response.status(502).json({ error: 'DATABASE_REQUEST_FAILED' });
    }
  };
}

export default createNotesHandler();
