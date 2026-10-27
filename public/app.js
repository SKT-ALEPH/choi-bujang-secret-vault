(async () => {
  if(!window.alephDevice)await new Promise(resolve=>document.addEventListener('aleph-device-ready',resolve,{once:true}));
  const $ = selector => document.querySelector(selector);
  const status = message => { $('#status').textContent = message; };
  const authError = message => { $('#auth-error').textContent = message; if (message) $('#auth-error').focus(); };
  const authMessage = error => ({ invalid_credentials:'이메일 또는 비밀번호가 맞지 않습니다.',
    xdr_web_injection:'반복된 웹 입력 공격 신호로 접근이 잠시 제한됐습니다. 최대 15분 뒤 다시 시도해 주세요.',
    xdr_brute_force:'로그인 실패가 반복돼 접근이 잠시 제한됐습니다. 최대 15분 뒤 다시 시도해 주세요.',
    email_not_confirmed:'가입 확인 이메일의 링크를 먼저 눌러 주세요.',
    netbird_gateway_required:'NetBird로 연결된 케셰브의 기존 자료실 열기로 접속해 주세요.',
    over_email_send_rate_limit:'메일 제공자의 발송 한도에 도달했습니다. 연속으로 다시 누르지 말고, 한도가 풀린 뒤 요청해 주세요. 기존 비밀번호 로그인도 사용할 수 있습니다.',
    ACCOUNT_BUSY:'다른 이메일 인증 요청을 처리 중입니다. 결과를 기다린 뒤 다시 요청해 주세요.',
    ACCOUNT_SETUP_UNAVAILABLE:'Windows 게이트웨이 또는 인증 원천의 응답을 끝까지 확인하지 못했습니다. NetBird 연결을 확인해 주세요. 메일 발송 성공으로 처리하지 않았습니다.',
    auth_unavailable:'인증 서버의 응답을 확인하지 못했습니다. 연결이 복구된 뒤 다시 요청해 주세요.',
    weak_password:'더 긴 비밀번호를 입력해 주세요.', signup_disabled:'현재 새 계정 가입이 비활성화돼 있습니다.' }[error.code] || '인증 요청에 실패했습니다. 입력 내용과 연결 상태를 확인해 주세요.');
  let client, signedIn = false, approved = false, signup = false, editingId = null, revision = 0, agentSession=null;
  async function currentSession(){
    const result=await client.auth.getSession();if(result.data?.session)return result;
    if(agentSession?.expires_at>Date.now()/1000)return {data:{session:agentSession},error:null};
    if(agentSession){agentSession=null;updateSession(null);}return result;
  }
  function clearEditor() { editingId = null; $('#editor').reset(); $('#editor-title').textContent='메모 추가'; $('#save-note').textContent='메모 추가'; $('#cancel-edit').hidden=true; }
  async function api(path = '', options = {}) {
    if(!approved||!navigator.onLine)throw new Error('기기 승인과 인터넷 연결을 먼저 확인해 주세요.');
    const { data, error } = await currentSession();
    if (error || !data.session) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
    const target = path === '' && (options.method ?? 'GET') === 'GET' ? '/api/my/notes' : '/api/notes'+path;
    const response = await fetch(target, { ...options, cache:'no-store',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+data.session.access_token,
        ...await window.alephDevice.headers(data.session,target,options) } });
    const body = await response.json();
    if(body.error==='DEVICE_NOT_APPROVED'){approved=false;window.alephDevice.clear();$('#notes').replaceChildren();$('#workspace').hidden=true;$('#device-panel').hidden=false;$('#device-state').textContent='승인이 만료됐습니다. 다시 승인을 요청해 주세요.';}
    if (!response.ok) throw new Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인해 주세요.'
      : body.error==='GRANT_REMOVED'?'이 기기의 자료실 이용 권한이 회수됐습니다. 케셰브에서 본인 접근을 복구하세요.'
      : body.error==='DEVICE_REVOKED'?'이 기기의 자료실 접근이 철회됐습니다. 케셰브에서 본인 접근을 복구하세요.'
      : typeof body.error==='string'&&body.error.startsWith('XDR_')?'XDR가 이 기기의 접근을 제한했습니다. 보안 기록을 확인하고 최대 15분 뒤 다시 조회하세요.'
      : response.status === 403 && ['XDR_BRUTE_FORCE','XDR_WEB_INJECTION'].includes(body.error) ? '반복 공격 신호로 접근이 잠시 제한됐습니다. 최대 15분 뒤 다시 시도해 주세요.'
      : response.status === 404 ? '메모를 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      : response.status === 409 ? '같은 메모 ID가 이미 있습니다.'
      : '자료 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return body;
  }
  async function loadNotes() {
    const current = revision;
    $('#notes').replaceChildren();
    $('#workspace').hidden=true;
    $('#notes').setAttribute('aria-busy','true');
    try {
      const notes = await api();
      if (current !== revision || !signedIn || !approved) return;
      if (!Array.isArray(notes)) throw new Error('자료 형식이 맞지 않습니다.');
      $('#workspace').hidden=false;$('#device-panel').hidden=true;$('#retry-notes')?.setAttribute('hidden','');
      const items = notes.map(note => {
        const item=document.createElement('li'), title=document.createElement('strong'), body=document.createElement('p'), actions=document.createElement('div');
        title.textContent=note.title; body.textContent=note.body; actions.className='actions';
        const edit=document.createElement('button'); edit.type='button'; edit.textContent='수정'; edit.setAttribute('aria-label',note.title+' 수정');
        edit.addEventListener('click',()=>{editingId=note.id; $('#note-title').value=note.title; $('#note-body').value=note.body; $('#editor-title').textContent='메모 수정'; $('#save-note').textContent='수정 저장'; $('#cancel-edit').hidden=false; $('#note-title').focus();});
        const remove=document.createElement('button'); remove.type='button'; remove.textContent='삭제'; remove.setAttribute('aria-label',note.title+' 삭제');
        remove.addEventListener('click',async()=>{
          if(!confirm('이 메모를 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
          remove.disabled=true;
          try { await api('/'+note.id,{method:'DELETE'}); if(editingId===note.id) clearEditor(); await loadNotes(); status('메모를 삭제했습니다.'); }
          catch(error){status(error.message);} finally{remove.disabled=false;}
        });
        actions.append(edit,remove); item.append(title,body,actions); return item;
      });
      if(!items.length){const item=document.createElement('li'); item.textContent='아직 내 메모가 없습니다. 메모 작성 영역에서 첫 메모를 추가하세요.';items.push(item);}
      $('#notes').replaceChildren(...items);
      status('내 메모를 불러왔습니다.');
    } catch(error){if(current===revision){$('#notes').replaceChildren();$('#workspace').hidden=true;$('#device-panel').hidden=!signedIn;$('#retry-notes')?.removeAttribute('hidden');$('#device-state').textContent='연결 또는 접근을 확인하지 못했습니다. 복구 후 자료를 다시 조회하세요.';status(error.message);}}
    finally { $('#notes').setAttribute('aria-busy','false'); }
  }
  function updateSession(session) {
    revision++; signedIn=Boolean(session);approved=false;window.alephDevice.clear();
    $('#device-panel').hidden=!signedIn;
    $('#device-state').textContent='서버의 기기 승인이 필요합니다. 승인 전에는 보호 자료를 요청하거나 표시하지 않습니다.';
    if ($('#auth-form').dataset.recovery==='true') {
      $('#auth-panel').hidden=false; $('#workspace').hidden=true;
      $('#auth-title').textContent='새 비밀번호 설정'; $('#auth-submit').textContent='비밀번호 저장';
      $('#email').required=false; $('#password').autocomplete='new-password';
      $('#notes').replaceChildren(); status('새 비밀번호를 입력해 저장해 주세요.'); return;
    }
    $('#auth-panel').hidden=signedIn; $('#workspace').hidden=true;
    $('#password').value=''; $('#notes').replaceChildren(); clearEditor();
    status(signedIn?'로그인됐습니다. 기기 승인을 요청해 주세요.':'로그인하면 기기 승인을 요청할 수 있습니다.');
  }
  try {
    const config=await(await fetch('/auth-config.json')).json();
    // Remove only the legacy SDK session entry; never read or copy its token.
    try{localStorage.removeItem('sb-'+new URL(config.url).hostname.split('.')[0]+'-auth-token');}catch{}
    client=window.supabase.createClient(config.url,'auth-via-server',{auth:{persistSession:false},global:{fetch:(target,options)=>{
      const url=new URL(target);
      if(url.origin!==new URL(config.url).origin || !url.pathname.startsWith('/auth/v1/')) throw new Error('AUTH_ROUTE_ONLY');
      const proxy=new URL('/api/auth',location.origin);
      proxy.search=url.search; proxy.searchParams.set('path',url.pathname.slice('/auth/v1/'.length));
      return fetch(proxy,options);
    }}});
    client.auth.onAuthStateChange((event,session)=>{
      if(session)agentSession=null;
      if(event==='PASSWORD_RECOVERY') {status('비밀번호 재설정 링크가 확인됐습니다. 새 비밀번호를 입력해 주세요.'); $('#auth-panel').hidden=false; $('#workspace').hidden=true; $('#auth-title').textContent='새 비밀번호 설정'; $('#auth-submit').textContent='비밀번호 저장'; $('#email').required=false; $('#auth-form').dataset.recovery='true'; return;}
      setTimeout(()=>updateSession(session),0);
    });
    const {data,error}=await client.auth.getSession(); if(error)throw error;
    if(!data.session&&location.pathname.startsWith('/vault/')){
      try{const response=await fetch('/api/netbird/session',{cache:'no-store'}),result=await response.json();if(response.ok&&result.ok)agentSession=result.data;}catch{}
    }
    updateSession(data.session??agentSession);
  } catch { status('로그인 설정을 불러오지 못했습니다. 페이지를 새로고침해 주세요.'); return; }
  $('#show-password').addEventListener('click',()=>{const shown=$('#password').type==='password';$('#password').type=shown?'text':'password';$('#show-password').textContent=shown?'숨기기':'표시';$('#show-password').setAttribute('aria-label',shown?'비밀번호 숨기기':'비밀번호 표시');$('#show-password').setAttribute('aria-pressed',String(shown));});
  $('#auth-mode').addEventListener('click',()=>{signup=!signup;$('#auth-title').textContent=signup?'자료실 계정 만들기':'자료실 로그인';$('#auth-submit').textContent=signup?'계정 만들기':'로그인';$('#auth-mode').textContent=signup?'로그인으로 돌아가기':'계정 만들기';$('#password').autocomplete=signup?'new-password':'current-password';$('#auth-help').textContent=signup?'가입 후 이메일로 받은 확인 링크를 눌러 주세요.':'가입한 이메일과 비밀번호로 로그인하세요.';authError('');});
  $('#auth-form').addEventListener('submit',async event=>{
    event.preventDefault(); authError(''); $('#auth-submit').disabled=true;
    try {
      const credentials={email:$('#email').value.trim(),password:$('#password').value};
      const recovery=$('#auth-form').dataset.recovery==='true';
      const result=recovery?await client.auth.updateUser({password:credentials.password}):signup
        ?await client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/'}})
        :await client.auth.signInWithPassword(credentials);
      if(result.error){authError(authMessage(result.error));return;}
      $('#password').value='';
      if(recovery){delete $('#auth-form').dataset.recovery;updateSession((await currentSession()).data.session);}
      else if(signup&&!result.data.session) status('확인 이메일을 보냈습니다. 이메일의 링크를 누른 뒤 로그인해 주세요.');
    } catch { authError('인증 서버에 연결하지 못했습니다. 다시 시도해 주세요.'); }
    finally {$('#auth-submit').disabled=false;}
  });
  $('#reset-password').addEventListener('click',async()=>{
    if(!$('#email').reportValidity())return;
    $('#reset-password').disabled=true;
    try {const {error}=await client.auth.resetPasswordForEmail($('#email').value.trim(),{redirectTo:location.origin+'/'});if(error)authError(authMessage(error));else status('이메일을 확인해 비밀번호 재설정을 진행해 주세요.');}
    catch {authError('요청을 보내지 못했습니다. 다시 시도해 주세요.');}finally{$('#reset-password').disabled=false;}
  });
  const logout=async()=>{const {data}=await currentSession();try{if(data.session)await window.alephDevice.revoke(data.session);}catch{}let remoteError=false;if(agentSession)try{const r=await fetch('/api/auth?path=logout',{method:'POST',headers:{authorization:'Bearer '+agentSession.access_token,'content-type':'application/json'},body:'{}'});remoteError=!r.ok;}catch{remoteError=true;}const {error}=await client.auth.signOut();agentSession=null;updateSession(null);if(error||remoteError)status('화면 세션은 비웠지만 서버 로그아웃 확인에 실패했습니다.');};
  $('#logout').addEventListener('click',logout);$('#device-logout').addEventListener('click',logout);
  $('#approve-device').addEventListener('click',async()=>{
    const current=revision;$('#approve-device').disabled=true;$('#device-state').textContent='서버가 로그인과 기기 키 소유 증명을 확인하고 있습니다.';
    try{const {data}=await currentSession();if(!data.session)throw Error('다시 로그인해 주세요.');
      const result=await window.alephDevice.approve(data.session);if(current!==revision)return;
      if(!result)throw Error('서버에서 기기 승인을 확인하지 못했습니다.');
      approved=true;$('#device-panel').hidden=true;$('#workspace').hidden=false;status('서버가 이 화면의 기기 접속을 승인했습니다.');await loadNotes();
    }catch(error){approved=false;window.alephDevice.clear();$('#workspace').hidden=true;$('#notes').replaceChildren();$('#device-state').textContent=error.message;}
    finally{$('#approve-device').disabled=false;}
  });
  window.addEventListener('offline',()=>{revision++;approved=false;window.alephDevice.clear();$('#workspace').hidden=true;$('#notes').replaceChildren();clearEditor();$('#device-panel').hidden=!signedIn;$('#device-state').textContent='오프라인입니다. 연결 후 기기 승인을 다시 요청해 주세요.';status('오프라인에서는 보호 자료를 표시하지 않습니다.');});
  let installPrompt;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-app').hidden=false;});
  $('#install-app').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('#install-app').hidden=true;}});
  if('serviceWorker' in navigator)void navigator.serviceWorker.register(location.pathname.startsWith('/vault/')?'/vault/sw.js':'/sw.js').catch(()=>status('오프라인 안내를 준비하지 못했습니다. 온라인 접속은 계속 사용할 수 있습니다.'));
  $('#editor').addEventListener('submit',async event=>{
    event.preventDefault(); $('#save-note').disabled=true;
    try {await api(editingId?'/'+editingId:'',{method:editingId?'PUT':'POST',body:JSON.stringify({title:$('#note-title').value,body:$('#note-body').value})});clearEditor();await loadNotes();status('메모를 저장했습니다.');}
    catch(error){status(error.message);}finally{$('#save-note').disabled=false;}
  });
  $('#cancel-edit').addEventListener('click',clearEditor);
  $('#retry-notes')?.addEventListener('click',loadNotes);
  if(location.pathname.startsWith('/vault/')){
    const verifyDirect=document.createElement('button');verifyDirect.type='button';verifyDirect.textContent='직접 우회 차단 확인';
    verifyDirect.addEventListener('click',async()=>{
      verifyDirect.disabled=true;
      try{
        const {data}=await currentSession();if(!approved||!data.session)throw Error('로그인과 기기 승인을 먼저 완료하세요.');
        const headers={authorization:'Bearer '+data.session.access_token,...await window.alephDevice.headers(data.session,'/api/my/notes',{})};
        const r=await fetch('/api/netbird/verify-direct',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({headers})}),d=await r.json();
        if(!r.ok||!d.ok)throw Error('우회 차단을 확인하지 못했습니다. 연결 상태를 확인하세요.');
        status(`동일한 로그인·기기 서명: 공개 주소 HTTP ${d.data.directStatus}, NetBird 경로 HTTP ${d.data.privateStatus}. ${d.data.passed?'직접 우회가 차단됐습니다.':'차단 조건을 충족하지 못했습니다.'}`);
      }catch(e){status(e.message);}finally{verifyDirect.disabled=false;}
    });
    $('#refresh').after(verifyDirect);
    const verifyXdr=document.createElement('button');verifyXdr.type='button';verifyXdr.textContent='XDR 차단 검증 · 이 기기 15분 격리';
    verifyXdr.addEventListener('click',async()=>{
      verifyXdr.disabled=true;
      try{
        const {data}=await currentSession();if(!approved||!data.session)throw Error('로그인과 기기 승인을 먼저 완료하세요.');
        // Literal syntax only: the gateway classifies it; no lookup or exploit runs.
        const target='/api/my/notes?id='+encodeURIComponent('${jndi:ldap://example.invalid/verification-only}');
        const headers={authorization:'Bearer '+data.session.access_token,...await window.alephDevice.headers(data.session,target,{})};
        const r=await fetch('/api/netbird/verify-xdr',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({headers})}),d=await r.json();
        if(!r.ok||!d.ok)throw Error('실제 XDR 거부를 확인하지 못했습니다.');
        $('#notes').replaceChildren();$('#workspace').hidden=true;$('#device-panel').hidden=false;$('#retry-notes')?.removeAttribute('hidden');
        status(`XDR 검사: HTTP ${d.data.status}, ${d.data.code}. ${d.data.passed?'기존 known-cve 판단기가 이 기기의 자료 접근을 15분 차단했습니다. 만료 후 다시 조회하세요.':'차단 조건을 충족하지 못했습니다.'}`);
      }catch(e){status(e.message);}finally{verifyXdr.disabled=false;}
    });$('#refresh').after(verifyXdr);
    const row=document.createElement('div');row.className='actions';
    const tokenLabel=document.createElement('label');tokenLabel.textContent='메일 확인 코드';
    const tokenInput=document.createElement('input');tokenInput.type='password';tokenInput.autocomplete='one-time-code';tokenInput.id='mail-confirm-token';tokenLabel.htmlFor=tokenInput.id;row.append(tokenLabel,tokenInput);
    for(const [operation,label] of [['signup','확인 메일로 계정 준비'],['login','확인 메일로 로그인'],['verify','메일 인증 완료']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',async()=>{
        if(!$('#email').reportValidity())return;button.disabled=true;authError('');
        try{
          const input={operation,email:$('#email').value.trim(),...(operation==='verify'?{tokenHash:tokenInput.value,type:tokenInput.dataset.type??'email'}:{})};
          const response=await fetch('/api/netbird/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}),result=await response.json();
          if(!response.ok){authError(authMessage({code:result.error_code??result.code}));return;}
          if(result.access_token&&result.refresh_token){tokenInput.value='';const {error}=await client.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});if(error)throw error;status('이메일 확인으로 로그인했습니다. 기기 승인을 요청해 주세요.');}
          else status('확인 메일을 보냈습니다. 해당 메일의 인증으로 계정 연결을 완료하세요.');
        }catch{authError('이메일 인증을 완료하지 못했습니다. 연결 상태를 확인하세요.');}
        finally{button.disabled=false;}
      });row.append(button);
    }
    $('#auth-form').after(row);
  }
  $('#refresh').addEventListener('click',loadNotes);
  $('#note-body').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')$('#editor').requestSubmit();});
  window.addEventListener('beforeunload', event => {
    if (signedIn && ($('#note-title').value || $('#note-body').value)) {
      event.preventDefault(); event.returnValue = '';
    }
  });
})();
