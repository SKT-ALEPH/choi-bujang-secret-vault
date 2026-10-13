(async () => {
  const status = document.querySelector('#status');
  const output = document.querySelector('#result');
  const storageKey = 'aleph.read-only-access-check';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
  let client;
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  const read = async (path, session) => {
    const response = await fetch(path, {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(15000),
      headers: {Authorization:'Bearer ' + session.access_token}});
    const body = await response.json();
    return {response, body};
  };
  const show = proof => { output.textContent = JSON.stringify(proof, null, 2); };
  async function check(mode) {
    document.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try {
      const {data, error} = await client.auth.getSession();
      if (error || !data.session) throw new Error('자료실에서 먼저 로그인해 주세요.');
      const session = data.session;
      const subject = await hash(session.user.id);
      let saved;
      if (mode === 'a') {
        const list = await read('/api/notes', session);
        if (list.response.status !== 200 || !Array.isArray(list.body)) throw new Error('A의 목록 조회가 정상 완료되지 않았습니다.');
        const noteId = list.body[0]?.id;
        if (!uuid.test(noteId ?? '')) throw new Error('A의 기존 메모가 없습니다. 새 자료를 만들지 않고 중단했습니다.');
        saved = {noteId, subject};
      } else {
        saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (!saved || !uuid.test(saved.noteId)) throw new Error('이 탭에서 먼저 A 조회를 확인해 주세요.');
        if (saved.subject === subject) throw new Error('아직 A 계정입니다. 자료실에서 다른 B 계정으로 로그인해 주세요.');
      }
      const {response, body} = await read('/api/notes/' + saved.noteId, session);
      const noteReturned = body?.id === saved.noteId && typeof body.title === 'string' && typeof body.body === 'string';
      const proof = {kind:'live_authenticated_http_read',account:mode.toUpperCase(),at:new Date().toISOString(),
        method:'GET',resourceFingerprint:await hash(saved.noteId),httpStatus:response.status,
        noteReturned,distinctFromA:mode === 'b',requestTrace:response.headers.get('x-vercel-id'),
        errorCode:typeof body?.error === 'string' ? body.error : null};
      if (mode === 'a') {
        if (response.status !== 200 || !noteReturned) { show(proof); throw new Error('A의 개별 조회가 정상 성공하지 않아 비교를 중단했습니다.'); }
        saved.aProof = proof;
        sessionStorage.setItem(storageKey, JSON.stringify(saved));
        show({a:proof});
        status.textContent = 'A의 본인 메모 조회: HTTP 200. 자료실에서 B로 로그인한 뒤 돌아오세요.';
      } else {
        const ownerDenial = response.status === 404 && body?.error === 'NOTE_NOT_FOUND' && !noteReturned;
        show({a:saved.aProof,b:proof,result:ownerDenial?'A_ALLOWED_B_DENIED':response.status === 200 && noteReturned?'OTHER_USER_NOTE_EXPOSED':'INCONCLUSIVE'});
        status.textContent = ownerDenial ? '같은 메모: A는 200, 다른 B는 404. 타인 조회가 거부됐습니다.'
          : response.status === 200 && noteReturned ? '같은 메모가 B에게도 반환됐습니다. 타인 조회 노출이 재현됐습니다.'
          : '인증·연결·추가 차단 문제로 소유자 검사를 판별하지 못했습니다.';
      }
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? '검증 결과 형식을 확인할 수 없습니다.' : error.message;
    } finally { document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  }
  try {
    const config = await (await fetch('/auth-config.json', {cache:'no-store'})).json();
    client = window.supabase.createClient(config.url, 'auth-via-server', {global:{fetch:(target,options)=>{
      const url = new URL(target);
      if (url.origin !== new URL(config.url).origin || !url.pathname.startsWith('/auth/v1/')) throw new Error('AUTH_ROUTE_ONLY');
      const proxy = new URL('/api/auth', location.origin);
      proxy.search = url.search;
      proxy.searchParams.set('path', url.pathname.slice('/auth/v1/'.length));
      return fetch(proxy, options);
    }}});
    status.textContent = 'A 조회를 먼저 확인하세요. 계정 전환 후 B 조회를 확인할 수 있습니다.';
    document.querySelector('#prepare').addEventListener('click', () => check('a'));
    document.querySelector('#compare').addEventListener('click', () => check('b'));
  } catch { status.textContent = '기존 로그인 설정을 불러오지 못했습니다.'; }
})();
