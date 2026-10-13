import notes from '../notes.js';

// Own-list entry point shares the original verified identity and atomic owner filter.
export default function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!request.headers?.authorization) return response.status(401).json({error:'LOGIN_REQUIRED'});
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }
  if (Object.keys(request.query ?? {}).length) return response.status(400).json({error:'RESOURCE_QUERY_NOT_ALLOWED'});
  return notes(request, response);
}
