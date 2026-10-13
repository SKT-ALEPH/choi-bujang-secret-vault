// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
// Describe the implemented APIs, not a fixture user's individual permissions.
const RESOURCE_ROUTES = [
  ['notes', 'GET', '/api/my/notes', 'my-notes'],
  ['notes', 'GET', '/api/notes', 'my-notes'],
  ['notes', 'POST', '/api/notes', 'my-notes'],
  ['notes', 'GET', '/api/notes/:id', 'my-notes'],
  ['notes', 'PUT', '/api/notes/:id', 'my-notes'],
  ['notes', 'DELETE', '/api/notes/:id', 'my-notes'],
  ['announcements', 'GET', '/api/announcements', 'class-notices'],
  ['announcements', 'GET', '/api/announcements/:id', 'class-notices'],
  ['announcements', 'PUT', '/api/announcements/:id', 'instructor-materials'],
].flatMap(([service, method, path, zone]) => [[service, method, path, zone],
  [service, method, path.replace(/^\/api/u, ''), zone]]);

export function hasEngineRouteDeclarations(routes) {
  if (!Array.isArray(routes) || routes.length !== RESOURCE_ROUTES.length) return false;
  const keys = new Set(routes.map(r => `${r?.method} ${r?.path}`));
  return keys.size === routes.length && RESOURCE_ROUTES.every(([service, method, path, zone]) =>
    routes.some(r => r?.service === service && r.method === method && r.path === path
      && r.pathPattern === path && r.zone === zone));
}

export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  if (config.step >= 3) {
    // The runner observes this metadata; it is never sent as a header or URL value.
    const request = (path, options, caseId, requestKey = 'read') => fetch(new URL(path, app), {
      ...options, redirect: 'error', signal: AbortSignal.timeout(10000),
      alephEvidence: { caseId, requestKey },
    });
    const attempts = [];
    // Submission checks are read-only; authenticated CRUD/restore is verified separately.
    const methods = config.step >= 11 ? ['GET'] : ['GET', 'POST', 'PUT', 'DELETE'];
    for (const method of methods) {
      const path = ['PUT','DELETE'].includes(method) ? '/api/notes/00000000-0000-4000-8000-000000000001' : '/api/notes';
      const response = await request(path, {method}, 'anonymous_' + method.toLowerCase(), method.toLowerCase());
      let safe = false;
      try { const body = await response.json(); safe = [401,403].includes(response.status)
        && typeof body.error === 'string' && !Object.hasOwn(body, 'notes'); } catch {}
      attempts.push({attackId:'anonymous_' + method.toLowerCase(),expected:'로그인 없는 자료 요청을 JSON 오류로 거부',
        observed:(safe?'확인':'실패') + ' · HTTP ' + response.status});
    }
    const forged = await request('/api/notes', {headers:{Authorization:'Bearer invalid.invalid.invalid'}}, 'invalid_login_token');
    attempts.push({attackId:'invalid_login_token',expected:'유효하지 않은 로그인 토큰 거부',observed:'HTTP ' + forged.status});
    const metadata = await request('/aleph.json', {}, 'deployment_identity');
    const identity = metadata.ok ? await metadata.json() : {};
    attempts.push({attackId:'deployment_identity',expected:config.step+'단계와 실제 저장소의 배포 정보',observed:
      (identity.step===config.step && identity.repoUrl?.toLowerCase()===config.repoUrl.toLowerCase()?'확인':'실패')+' · HTTP '+metadata.status});
    const page = await request('/', {}, 'security_header');
    attempts.push({attackId:'security_header',expected:'첫 화면 nosniff 헤더',observed:
      (page.headers.get('x-content-type-options')==='nosniff'?'확인':'실패')+' · HTTP '+page.status});
    if (config.step >= 4) {
      const { readFile } = await import('node:fs/promises');
      const publicConfig = JSON.parse(await readFile(new URL(config.step >= 5 ? '../config/supabase-public.json' : '../public/auth-config.json', import.meta.url), 'utf8'));
      const directUrl = config.step >= 5 ? new URL(config.originalApiUrl) : new URL('/rest/v1/notes',publicConfig.url);
      directUrl.searchParams.set('select','id');
      const direct = await fetch(directUrl, {
        headers: { apikey: publicConfig.publishableKey }, redirect: 'error', signal: AbortSignal.timeout(10000),
        alephEvidence: { caseId: 'anonymous_direct_database', requestKey: 'read' },
      });
      let denied = false;
      try { const body = await direct.json(); denied = [401,403].includes(direct.status) && !Array.isArray(body); } catch {}
      attempts.push({attackId:'anonymous_direct_database',expected:'anon 키로 직접 DB 자료 조회 거부',
        observed:(denied?'확인':'실패')+' · HTTP '+direct.status});
    }
    if (config.step >= 5) {
      if (config.step >= 8 && !hasEngineRouteDeclarations(config.allowedRoutes)) {
        throw new Error('8단계 자료 API 경로의 service·method·pathPattern·zone 선언을 모두 확인해 주세요.');
      }
      let clean = true;
      const leaked = /sb_publishable_[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/u;
      for (const [index, path] of ['/', '/app.js', '/auth-config.json', '/vendor/supabase.js', '/data.json'].entries()) {
        const response = await request(path, {}, 'public_assets_no_keys_or_seed', 'asset-' + index);
        const body = await response.text();
        clean &&= response.ok && !leaked.test(body) && !body.includes(config.sampleMarker);
      }
      attempts.push({attackId:'public_assets_no_keys_or_seed',expected:'공개 화면·SDK·설정·자료 파일에 키와 시드 자료 없음',observed:clean?'확인 · 공개 파일 5개':'실패'});
      attempts.push({attackId:'allowed_routes_metadata',expected:'배포 정보에 허용 자료 경로와 쿼리 없는 원본 HTTPS 주소',observed:
        ((config.step >= 8 ? hasEngineRouteDeclarations(identity.allowedRoutes)
          && JSON.stringify(identity.allowedRoutes) === JSON.stringify(config.allowedRoutes)
          : identity.allowedRoutes?.length > 0)
          && identity.originalApiUrl===config.originalApiUrl && !new URL(config.originalApiUrl).search?'확인':'실패')});
      const auth = await request('/api/auth?path=rest/v1/notes', {}, 'auth_proxy_rejects_data_route');
      attempts.push({attackId:'auth_proxy_rejects_data_route',expected:'Auth 함수로 자료 주소 우회 불가',observed:'HTTP '+auth.status});
    }
    if (config.step >= 6) {
      const { decide } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { normal } = fixtureRequests();
      const results = [];
      for (const [name, value, expected] of [
        ['registered', true, 'allow'], ['unregistered', false, 'deny'], ['missing', undefined, 'deny'],
      ]) {
        const response = await decide({ ...normal, deviceRegistered: value });
        results.push({name,passed:response.decision===expected
          && (expected==='allow'||response.reasonCode==='device_not_registered')});
      }
      attempts.push({attackId:'local_device_registration',
        expected:'로컬 가상 판정 · 등록allow, 미등록/누락deny device_not_registered',
        observed:results.every(r=>r.passed)?'확인 · 등록/미등록/누락3조건':'실패'});
    }
    if (config.step >= 7) {
      const { decide } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { suspicious } = fixtureRequests();
      for (const [name, stepUp, expected] of [['unverified', suspicious.stepUp, 'step_up'],
        ['confirmed', { verified: true, authAgeSeconds: 60 }, 'allow']]) {
        const response = await decide({ ...suspicious, stepUp });
        attempts.push({ attackId: 'local_step_up_' + name, expected: '로컬 가상 판정 · ' + expected,
          observed: (response.decision === expected ? '확인' : '실패') + ' · ' + response.decision });
      }
    }
    if (config.step >= 8) {
      const { decide } = await import('./decider.mjs');
      const { fixtureRequests } = await import('../scripts/fixture-7.mjs');
      const { normal } = fixtureRequests();
      const denied = [];
      for (const fields of [{path:'/notes',route:'GET /notes'}, {path:'/api/notes',route:'GET /api/notes'}, { path: '/notes/export' }, { path: '/notes/demo/export' },
        { path: '/notes/other' }, { path: '/other/demo' }, { subjectId: '' }, { queryLength: 1 },
        { role: 'teacher' }, { path: '/notes/demo', route: 'GET /api/notes/:id' },
        { service: 'announcements', method: 'PUT', path: '/announcements/demo', route: 'PUT /announcements/:id' },
        { method: 'PUT', path: '/announcements/demo', route: 'GET /announcements/:id' }]) {
        denied.push((await decide({ ...normal, ...fields })).decision === 'deny');
      }
      const admitted = [];
      for (const prefix of ['', '/api']) {
        for (const id of ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']) {
          admitted.push((await decide({ ...normal, subjectId: 'synthetic-independent-subject',
            classId: 'synthetic-independent-class', projectId: 'synthetic-independent-project',
            deviceId: 'bbbbbbbbbbbbbbbb', policyRevision: 2,
            signals: {source:'none',region:'unknown',network:'unknown',hour:14},
            path: `${prefix}/notes/${id}`, route: `GET ${prefix}/notes/:id` })).decision === 'allow');
        }
      }
      attempts.push({ attackId: 'local_resource_scope', expected: '로컬 가상 · 선언 경로 입장과 미지/기능/경로불일치/위조 거부; 최종 소유권 API별도',
        observed: denied.every(Boolean) && admitted.every(Boolean)
          ? '확인 · 거부 ' + denied.length + '개 / 독립 자원 입장 ' + admitted.length + '개' : '실패' });
      for (const method of config.step >= 11 ? ['GET'] : ['GET', 'PUT']) {
        const response = await request('/api/announcements/00000000-0000-4000-8000-000000000001', { method }, 'anonymous_announcement_' + method.toLowerCase());
        let safe = false;
        try { const body = await response.json(); safe = response.status === 401 && typeof body.error === 'string'; } catch {}
        attempts.push({ attackId: 'anonymous_announcement_' + method.toLowerCase(), expected: '실제 HTTP · 비로그인 공지 접근 거부',
          observed: (safe ? '확인' : '실패') + ' · HTTP ' + response.status });
      }
    }
    if (config.step >= 9) {
      const {detect} = await import('./detect.mjs');
      const {checkDetection} = await import('../scripts/detect-test.mjs');
      const checks = await checkDetection(detect);
      attempts.push({attackId:'local_revocation_proposal',
        expected:'로컬 가상 사건 · 동일 주체 GET 120/121 경계와 사용자/시간창 분리; 실제 회수는 심판 확인',
        observed:checks.every(c=>c.passed)?`확인 · ${checks.length}조건; 실제 기기 회수로 주장하지 않음`:'실패'});
    }
    if (config.step >= 10) {
      const {loadSafePolicy} = await import('./recovery-policy.mjs');
      const safe = await loadSafePolicy();
      attempts.push({attackId:'local_safe_policy_backup',expected:'사전 안전 정책 사본을 다시 읽어 고정 버전과 파일 SHA-256 검증',
        observed:`확인 · ${safe.version} / ${safe.files.length}파일; 운영 정책 변경 없음`});
      if (typeof config.restoreRoute!=='string'||!config.restoreRoute.startsWith('/api/restore/')
          ||identity.restoreRoute!==config.restoreRoute)throw Error('10단계 복원 경로 선언과 실제 배포 정보를 확인해 주세요.');
      if (config.step < 11) {
        const restored = await request(config.restoreRoute.replace(':noteId','00000000-0000-4000-8000-000000000001'),{method:'POST'},'anonymous_restore_denied');
        const body = await restored.json().catch(()=>null);
        attempts.push({attackId:'anonymous_restore_denied',expected:'실제 HTTP · 비로그인 단일 메모 복원 요청 거부',
          observed:restored.status===401&&body?.error==='LOGIN_REQUIRED'?'확인 · HTTP 401':'실패 · HTTP '+restored.status});
      }
    }
    if(config.step>=11){
      const manifest=await request('/manifest.webmanifest',{},'installable_app_manifest'),m=await manifest.json().catch(()=>null);
      attempts.push({attackId:'installable_app_manifest',expected:'실제 HTTP · 기존 자료실 시작주소/설치설정/이름',
        observed:manifest.ok&&m?.start_url==='/'&&m.display==='standalone'&&m.name?'확인 · manifest200':'실패'});
      const offline=await request('/offline.html',{},'offline_no_protected_data'),text=await offline.text();
      attempts.push({attackId:'offline_no_protected_data',expected:'실제 HTTP · 자료/키없는오프라인설명',
        observed:offline.ok&&text.includes('인터넷 연결이 필요합니다')&&!text.includes(config.sampleMarker)?'확인 · offline200':'실패'});
      const device=await request('/api/device?operation=status',{},'anonymous_device_status'),result=await device.json().catch(()=>null);
      attempts.push({attackId:'anonymous_device_status',expected:'실제 HTTP · 로그인/기기확인없는승인불가',
        observed:device.status===401&&result?.error==='LOGIN_REQUIRED'?'확인 · HTTP401':'실패'});
    }
    return attempts;
  }
  if (config.step === 2) {
    const request = path => fetch(new URL(path, app), {
      redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const staticResponse = await request('/data.json');
    let staticRemoved = staticResponse.status === 404;
    if (staticResponse.ok) {
      try {
        const body = await staticResponse.json();
        staticRemoved = Array.isArray(body.notes) && body.notes.length === 0;
      } catch { /* A successful HTML fallback does not prove removal. */ }
    }
    const apiResponse = await request('/api/notes');
    let count = 0;
    if (apiResponse.ok) {
      try {
        const body = await apiResponse.json();
        count = Array.isArray(body.notes) ? body.notes.length : 0;
      } catch { /* The API must respond with JSON. */ }
    }
    const identityResponse = await request('/aleph.json');
    let identityMatches = false;
    if (identityResponse.ok) {
      try {
        const identity = await identityResponse.json();
        identityMatches = identity.step === 2
          && identity.repoUrl?.toLowerCase() === config.repoUrl.toLowerCase()
          && /^[a-f0-9]{40}$/u.test(identity.commit);
      } catch { /* Invalid metadata is not a successful check. */ }
    }
    const page = await request('/');
    const headerPresent = page.headers.get('x-content-type-options') === 'nosniff';
    return [
      { attackId: 'static_note_read', expected: '공개 정적 파일에 메모가 없음',
        observed: `${staticRemoved ? '확인' : '실패'} · HTTP ${staticResponse.status}` },
      { attackId: 'server_note_read', expected: '공개 서버 API가 가상 자료 4건을 반환함; 로그인 검사는 다음 단계',
        observed: `HTTP ${apiResponse.status} · 자료 ${count}건` },
      { attackId: 'deployment_identity', expected: '현재 단계와 저장소가 일치하는 배포 정보',
        observed: `${identityMatches ? '확인' : '실패'} · HTTP ${identityResponse.status}` },
      { attackId: 'security_header', expected: '첫 화면 응답에 nosniff 헤더',
        observed: `${headerPresent ? '확인' : '실패'} · HTTP ${page.status}` },
    ];
  }
  const response = await fetch(new URL('/data.json', app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let visible = false;
  if (response.ok) {
    try {
      const data = await response.json();
      visible = data?.sampleMarker === config.sampleMarker && Array.isArray(data.notes)
        && data.notes.length > 0;
    } catch {
      // A non-JSON response is a failed check, not a successful deployment.
    }
  }
  return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
    observed: visible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임' : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})` }];
}
