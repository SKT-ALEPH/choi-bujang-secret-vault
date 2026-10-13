import { productionRuntime } from './notes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const publicAnnouncement = ({ id, title, content }) => ({ id, title, body: content });

export function createAnnouncementsHandler(getRuntime = productionRuntime) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!request.headers?.authorization) return response.status(401).json({ error: 'LOGIN_REQUIRED' });
    let database, identity, xdr;
    try {
      const services = getRuntime();
      ({ database, xdr } = services);
      identity = await services.verifyLoginAuthorization(request.headers.authorization);
    } catch { return response.status(503).json({ error: 'AUTH_NOT_CONFIGURED' }); }
    if (!identity) return response.status(401).json({ error: 'INVALID_LOGIN' });
    const method = request.method;
    if (!['GET', 'PUT'].includes(method)) {
      response.setHeader('Allow', 'GET, PUT');
      return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    }
    const id = request.query?.id;
    if (Object.keys(request.query ?? {}).some(key => key !== 'id')) return response.status(400).json({ error: 'RESOURCE_QUERY_NOT_ALLOWED' });
    if (id !== undefined && (typeof id !== 'string' || !UUID.test(id))) return response.status(400).json({ error: 'INVALID_RESOURCE_ID' });
    if (method === 'PUT' && !id) return response.status(400).json({ error: 'RESOURCE_ID_REQUIRED' });
    response.setHeader('X-Resource-ID', id ? 'announcements/' + id : 'announcements');
    let input;
    if (method === 'PUT') {
      try { input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; } catch {}
      if (!input || Object.keys(input).some(key => !['title', 'body'].includes(key))
          || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
          || typeof input.body !== 'string' || input.body.length > 10000) {
        return response.status(400).json({ error: 'INVALID_RESOURCE_INPUT' });
      }
    }
    try {
      if (xdr) {
        const blocked = await xdr.check(request) ?? (xdr.inspect ? await xdr.inspect(request, input) : null);
        if (blocked) {
          response.setHeader('Retry-After', String(blocked.retryAfter));
          response.setHeader('X-XDR-Evidence', blocked.evidenceId);
          return response.status(403).json({ error: 'XDR_BLOCKED' });
        }
      }
      let query;
      if (method === 'GET') {
        query = database.from('announcements').select('id,title,content');
        query = id ? query.eq('id', id).maybeSingle() : query.order('id').limit(100);
      } else {
        // The RPC checks the stored, per-resource instructor grant in the UPDATE itself.
        query = database.rpc('edit_announcement', { p_user: identity.userId, p_id: id,
          p_title: input.title.trim(), p_content: input.body });
      }
      const { data, error } = await query.abortSignal(AbortSignal.timeout(10000));
      if (error) return response.status(502).json({ error: 'DATABASE_REQUEST_FAILED' });
      if (method === 'PUT') {
        if (!Array.isArray(data) || data.length !== 1) return response.status(403).json({ error: 'ANNOUNCEMENT_EDIT_DENIED' });
        return response.status(200).json(publicAnnouncement(data[0]));
      }
      if (id && !data) return response.status(404).json({ error: 'RESOURCE_NOT_FOUND' });
      return response.status(200).json(id ? publicAnnouncement(data) : data.map(publicAnnouncement));
    } catch { return response.status(502).json({ error: 'DATABASE_REQUEST_FAILED' }); }
  };
}

export default createAnnouncementsHandler();
