// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2, 3, 4, 5].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
    const request = (path, options = {}) => fetch(new URL(path, app), {
      ...options, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const attempts = [];
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const path = ['PUT','DELETE'].includes(method) ? '/api/notes/00000000-0000-4000-8000-000000000001' : '/api/notes';
      const response = await request(path, {method});
      let safe = false;
      try { const body = await response.json(); safe = [401,403].includes(response.status)
        && typeof body.error === 'string' && !Object.hasOwn(body, 'notes'); } catch {}
      attempts.push({attackId:'anonymous_' + method.toLowerCase(),expected:'로그인 없는 자료 요청을 JSON 오류로 거부',
        observed:(safe?'확인':'실패') + ' · HTTP ' + response.status});
    }
    const forged = await request('/api/notes', {headers:{Authorization:'Bearer invalid.invalid.invalid'}});
    attempts.push({attackId:'invalid_login_token',expected:'유효하지 않은 로그인 토큰 거부',observed:'HTTP ' + forged.status});
    const metadata = await request('/aleph.json');
    const identity = metadata.ok ? await metadata.json() : {};
    attempts.push({attackId:'deployment_identity',expected:config.step+'단계와 실제 저장소의 배포 정보',observed:
      (identity.step===config.step && identity.repoUrl?.toLowerCase()===config.repoUrl.toLowerCase()?'확인':'실패')+' · HTTP '+metadata.status});
    const page = await request('/');
    attempts.push({attackId:'security_header',expected:'첫 화면 nosniff 헤더',observed:
      (page.headers.get('x-content-type-options')==='nosniff'?'확인':'실패')+' · HTTP '+page.status});
    if (config.step >= 4) {
      const { readFile } = await import('node:fs/promises');
      const publicConfig = JSON.parse(await readFile(new URL(config.step >= 5 ? '../config/supabase-public.json' : '../public/auth-config.json', import.meta.url), 'utf8'));
      const directUrl = config.step >= 5 ? new URL(config.originalApiUrl) : new URL('/rest/v1/notes',publicConfig.url);
      directUrl.searchParams.set('select','id');
      const direct = await fetch(directUrl, {
        headers: { apikey: publicConfig.publishableKey }, redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      let denied = false;
      try { const body = await direct.json(); denied = [401,403].includes(direct.status) && !Array.isArray(body); } catch {}
      attempts.push({attackId:'anonymous_direct_database',expected:'anon 키로 직접 DB 자료 조회 거부',
        observed:(denied?'확인':'실패')+' · HTTP '+direct.status});
    }
    if (config.step === 5) {
      let clean = true;
      const leaked = /sb_publishable_[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]+/u;
      for (const path of ['/', '/app.js', '/auth-config.json', '/vendor/supabase.js', '/data.json']) {
        const response = await request(path);
        const body = await response.text();
        clean &&= response.ok && !leaked.test(body) && !body.includes(config.sampleMarker);
      }
      attempts.push({attackId:'public_assets_no_keys_or_seed',expected:'공개 화면·SDK·설정·자료 파일에 키와 시드 자료 없음',observed:clean?'확인 · 공개 파일 5개':'실패'});
      attempts.push({attackId:'allowed_routes_metadata',expected:'배포 정보에 허용 자료 경로와 쿼리 없는 원본 HTTPS 주소',observed:
        (identity.allowedRoutes?.length > 0 && identity.originalApiUrl===config.originalApiUrl && !new URL(config.originalApiUrl).search?'확인':'실패')});
      const auth = await request('/api/auth?path=rest/v1/notes');
      attempts.push({attackId:'auth_proxy_rejects_data_route',expected:'Auth 함수로 자료 주소 우회 불가',observed:'HTTP '+auth.status});
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
