import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../api/notes.js';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';

function response() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('missing database settings fail closed without a static fallback', async () => {
  const original = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const result = response();
    await handler({ method: 'GET' }, result);
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.body, { error: 'DATABASE_NOT_CONFIGURED' });
    assert.equal(result.headers['Cache-Control'], 'no-store');
  } finally {
    if (original === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = original;
  }
});

test('server rejects writes and never exposes upstream errors or credentials', async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = 'https://stage2-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'test-only-credential';
  try {
    const write = response();
    await handler({ method: 'POST' }, write);
    assert.equal(write.statusCode, 405);
    globalThis.fetch = async (url, options) => {
      assert.equal(new URL(url).pathname, '/rest/v1/notes');
      assert.equal(options.headers.apikey, 'test-only-credential');
      assert.equal(options.redirect, 'error');
      return new Response('test-only-credential private upstream failure', { status: 403 });
    };
    const failure = response();
    await handler({ method: 'GET' }, failure);
    assert.equal(failure.statusCode, 502);
    assert.deepEqual(failure.body, { error: 'DATABASE_READ_FAILED' });
    globalThis.fetch = async () => new Response(JSON.stringify([
      { title: 'fixture', content: 'fixture-value' },
    ]), { status: 200 });
    const success = response();
    await handler({ method: 'GET' }, success);
    assert.equal(success.statusCode, 200);
    assert.deepEqual(success.body, { notes: [{ title: 'fixture', content: 'fixture-value' }] });
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

test('stage 2 metadata preserves the actual Vercel commit identity', () => {
  const identity = deploymentIdentity({
    VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'Student',
    VERCEL_GIT_REPO_SLUG: 'vault', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_URL: 'vault-test.vercel.app',
  }, {
    step: 2, sampleMarker: 'SAMPLE_NOTE_1',
    judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  });
  assert.equal(identity.step, 2);
  assert.equal(identity.commit, 'a'.repeat(40));
});
