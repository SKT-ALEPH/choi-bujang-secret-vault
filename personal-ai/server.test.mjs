import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createPersonalServer} from './server.mjs';
import {renderReadable} from './public/readable.mjs';

test('AI formatting keeps HTML and event handlers as literal text', () => {
  class Node {
    constructor(tag, value = '') { this.tag = tag; this.value = value; this.children = []; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren() { this.children = []; }
    set textContent(value) { this.value = value; this.children = []; }
    get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
  }
  const document = {createElement: tag => new Node(tag), createTextNode: value => new Node('#text', value)};
  const target = new Node('div');
  renderReadable(document, target, '<img src=x onerror=alert(1)> **확인된 사실**\n\n- 첫째\n- <script>alert(2)</script>');
  const walk = node => [node, ...node.children.flatMap(walk)];
  assert.ok(walk(target).every(node => ['div', 'p', 'strong', 'ul', 'li', '#text'].includes(node.tag)));
  assert.match(target.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(target.textContent, /<script>alert\(2\)<\/script>/);
  assert.equal(walk(target).find(node => node.tag === 'strong').textContent, '확인된 사실');
  assert.equal(walk(target).filter(node => node.tag === 'li').length, 2);
});

test('personal AI isolates OAuth, requires a current model and discards cancelled responses', async t => {
  const state = {status: 'disconnected', sharing: false};
  let server, inferenceCalls = 0, finishSignIn, releaseResponse;
  const client = {
    getSession: async () => structuredClone(state),
    listProfiles: async () => state.profileId ? [{id: state.profileId, label: 'Personal', status: state.status}] : [],
    signIn: async () => {
      state.status = 'connecting';
      server.openAuthorization('https://auth.openai.com/api/accounts/authorize?state=test-only');
      await new Promise(resolve => { finishSignIn = resolve; });
    },
    cancelSignIn: () => { if (state.status === 'connecting') { state.status = 'disconnected'; finishSignIn?.(); } },
    disconnect: async () => { Object.assign(state, {status: 'disconnected', sharing: false}); },
    selectProfile: async () => {},
    listModels: async () => [{slug: 'test-model', displayName: 'Test model'}],
    streamResponse: async ({input}) => {
      inferenceCalls++;
      if (input === 'throw-safe-error') throw Object.assign(Error('PRIVATE_TOKEN_MUST_NOT_LEAK'), {code: 'unknown_backend_code'});
      if (input === 'delayed') await new Promise(resolve => { releaseResponse = resolve; });
      return {text: 'Test-only completed response'};
    },
  };
  server = await createPersonalServer(client);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  const cookie = page.headers.get('set-cookie').split(';')[0];
  assert.match(page.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const html = await page.text();
  assert.match(html, /Continue with ChatGPT/);
  // The provided keyboard navigation must own the added tab and panel too.
  assert.match(html, /id="tab-personal"[^>]*aria-controls="view-personal"[^>]*aria-selected="true"/);
  assert.match(html, /id="view-personal"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-personal"/);
  assert.match(html, /id="view-protection"[^>]*hidden/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'UI IDs stay unique');
  async function request(path, body = {}, options = {}) {
    const response = await fetch(origin + '/personal-ai/' + path, {
      method: 'POST', headers: {'content-type': 'application/json', origin, cookie, ...options.headers}, body: JSON.stringify(body), redirect: 'manual',
    });
    return {status: response.status, data: await response.json()};
  }
  assert.equal((await request('models', {}, {headers: {origin: 'https://untrusted.invalid'}})).status, 403);
  assert.equal((await request('models', {}, {headers: {cookie: ''}})).status, 403);
  assert.equal((await request('models')).data.error.code, 'sign_in_required');
  assert.equal((await request('login')).status, 202);
  const redirect = await fetch(origin + '/personal-ai/authorize', {headers: {cookie}, redirect: 'manual'});
  assert.equal(redirect.status, 303);
  assert.equal(new URL(redirect.headers.get('location')).origin, 'https://auth.openai.com');
  assert.equal((await request('signin-cancel')).data.ok, true);
  Object.assign(state, {status: 'connected', sharing: false, profileId: 'test-profile'});
  assert.equal((await request('models')).data.error.code, 'sharing_not_enabled');
  state.sharing = true;
  assert.equal((await request('check', {model: 'test-model'})).data.error.code, 'model_not_found');
  assert.equal(inferenceCalls, 0);
  assert.equal((await request('models')).data.models.length, 1);
  assert.equal((await request('check', {model: 'not-in-catalog'})).data.error.code, 'model_not_found');
  // Errors require an explicit model reload; there is no model fallback.
  await request('models');
  const check = await request('check', {model: 'test-model'});
  assert.equal(check.data.inferenceCompleted, true);
  assert.equal(check.data.alephApproved, false);
  assert.equal(inferenceCalls, 1);
  const invalid = await request('explain', {model: 'test-model', text: ''});
  assert.equal(invalid.status, 400);
  await request('models');
  const unknown = await request('explain', {model: 'test-model', text: 'throw-safe-error'});
  assert.equal(unknown.data.error.code, 'personal_ai_unverified');
  assert.doesNotMatch(JSON.stringify(unknown), /PRIVATE_TOKEN/);
  await request('models');
  const pending = request('explain', {model: 'test-model', text: 'delayed'});
  // Observe dispatch without timing assumptions.
  while (!releaseResponse) await new Promise(resolve => setImmediate(resolve));
  await request('cancel'); releaseResponse();
  const cancelled = await pending;
  assert.equal(cancelled.data.ok, false);
  assert.equal(cancelled.data.error.code, 'cancelled');
  assert.doesNotMatch(JSON.stringify(cancelled), /Test-only completed response/);
  assert.equal((await request('disconnect')).data.ok, true);
  assert.equal((await request('models')).data.error.code, 'sign_in_required');
  const invalidBody = await request('models', {unexpected: 'not-allowed'});
  assert.equal(invalidBody.status, 400);
  const original = await fetch(origin + '/api/notes');
  assert.notEqual(original.status, 200);
});

test('stage17 personal mode classifies safe errors and supports explicit recovery', async t => {
  let failure;
  const client = {
    getSession: async () => ({status: 'connected', sharing: true, profileId: 'profile-a'}),
    listProfiles: async () => [], cancelSignIn() {},
    listModels: async () => { if (failure) throw failure; return [{slug: 'test-model', displayName: 'Test'}]; },
    streamResponse: async () => ({text: 'Completed test response'}),
  };
  const server = await createPersonalServer(client);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(origin)).headers.get('set-cookie').split(';')[0];
  const request = async (path, body = {}) => (await fetch(origin + '/personal-ai/' + path, {method: 'POST',
    headers: {origin, cookie, 'content-type': 'application/json'}, body: JSON.stringify(body)})).json();
  for (const [source, status, expected] of [
    ['invalid_grant', 400, 'authentication_required'],
    ['chatpass_v2_scope_not_authorized', 403, 'permission_denied'],
    ['subscription_sharing_usage_limit_exceeded', 429, 'subscription_sharing_usage_limit_exceeded'],
    ['api_error', 429, 'rate_limited'], ['api_error', 504, 'timeout'],
    ['api_error', 503, 'service_unavailable'], ['network_error', undefined, 'network_error'],
    ['stream_interrupted', undefined, 'response_unverified'],
    ['storage_decryption_failed', undefined, 'secure_storage_unavailable'],
  ]) {
    failure = Object.assign(Error('PRIVATE_RESPONSE_DO_NOT_EXPOSE'), {code: source, status});
    const result = await request('models');
    assert.equal(result.error.code, expected);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_RESPONSE/);
    assert.equal(result.models, undefined);
    failure = undefined;
    const recovered = await request('models');
    assert.equal(recovered.ok, true);
    assert.equal(recovered.models.length, 1);
    assert.equal(recovered.error, undefined);
    assert.equal(recovered.inferenceCompleted, undefined, 'catalog is never an inference success');
  }
  const explained = await request('explain', {model: 'test-model', text: '[가상 보안 기록] 로그인 실패 25회'});
  assert.match(explained.inputId, /^manual-[a-f0-9-]{36}$/);
  assert.equal(explained.source, 'manual-input');
  assert.equal(explained.alephApproved, false);
});

test('whole-operation timeout and cancel release busy state even when provider ignores abort; stale results never publish', async t => {
  let profileId = 'a', blocked = false, entered, release;
  const client = {
    getSession: async () => ({status: 'connected', sharing: true, profileId}),
    listProfiles: async () => [], cancelSignIn() {},
    listModels: async () => {
      if (blocked) { entered = true; await new Promise(resolve => { release = resolve; }); }
      return [{slug: blocked ? 'old-model' : 'current-model', displayName: 'Test'}];
    },
    streamResponse: async () => { profileId = 'b'; return {text: 'wrong-account-response'}; },
  };
  const server = await createPersonalServer(client, {requestTimeoutMs: 150});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { release?.(); server.closeAllConnections(); server.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(origin)).headers.get('set-cookie').split(';')[0];
  const request = async (path, body = {}) => (await fetch(origin + '/personal-ai/' + path, {method: 'POST',
    headers: {origin, cookie, 'content-type': 'application/json'}, body: JSON.stringify(body)})).json();
  const waitEntered = async () => { while (!entered) await new Promise(resolve => setImmediate(resolve)); };
  blocked = true;
  const timedOut = request('models');
  await waitEntered();
  assert.equal((await request('models')).error.code, 'connection_busy');
  assert.equal((await timedOut).error.code, 'timeout');
  const oldRelease = release;
  blocked = false;
  assert.equal((await request('models')).models[0].slug, 'current-model');
  oldRelease();
  await new Promise(resolve => setImmediate(resolve));
  // A finished but discarded old catalog cannot replace the current catalog.
  assert.equal((await request('check', {model: 'old-model'})).error.code, 'model_not_found');
  blocked = true; entered = false;
  const cancelled = request('models');
  await waitEntered();
  await request('cancel');
  assert.equal((await cancelled).error.code, 'cancelled', 'no need to release the provider first');
  const cancelledRelease = release;
  blocked = false;
  await request('models'); cancelledRelease();
  const changed = await request('explain', {model: 'current-model', text: '[가상] 계정 변경 경계'});
  assert.equal(changed.error.code, 'connection_changed');
  assert.doesNotMatch(JSON.stringify(changed), /wrong-account-response/);
});
