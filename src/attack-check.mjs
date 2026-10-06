// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 2].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
