// Stage 2: the server holds the database key. Authentication comes in stage 3.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const projectUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!projectUrl || !secretKey) {
    return response.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
  }

  try {
    const url = new URL('/rest/v1/notes', projectUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
      return response.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    url.searchParams.set('select', 'title,content');
    url.searchParams.set('order', 'id.asc');
    url.searchParams.set('limit', '100');
    const headers = { apikey: secretKey };
    // Legacy service_role JWTs need a Bearer token. New secret keys use apikey only.
    if (secretKey.startsWith('eyJ')) headers.Authorization = `Bearer ${secretKey}`;
    const result = await fetch(url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) {
      const failure = await result.json().catch(() => ({}));
      console.warn('Supabase read rejected', {
        status: result.status,
        code: /^[A-Z0-9]{5}$/u.test(failure.code || '') ? failure.code : 'unspecified',
        keyType: secretKey.startsWith('sb_secret_') ? 'secret'
          : secretKey.startsWith('eyJ') ? 'legacy'
          : secretKey.startsWith('sb_publishable_') ? 'publishable' : 'unrecognized',
      });
      return response.status(502).json({ error: 'DATABASE_READ_FAILED' });
    }
    const notes = await result.json();
    if (!Array.isArray(notes) || notes.some(note =>
      typeof note.title !== 'string' || typeof note.content !== 'string')) {
      return response.status(502).json({ error: 'DATABASE_RESPONSE_INVALID' });
    }
    return response.status(200).json({ notes });
  } catch (error) {
    console.warn('Supabase request failed', {
      type: error?.name === 'TimeoutError' ? 'timeout' : 'request_failed',
    });
    // Do not echo upstream errors, URLs, or keys to the client or logs.
    return response.status(502).json({ error: 'DATABASE_READ_FAILED' });
  }
}
