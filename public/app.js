(async () => {
  const $ = selector => document.querySelector(selector);
  const status = message => { $('#status').textContent = message; };
  const authError = message => { $('#auth-error').textContent = message; if (message) $('#auth-error').focus(); };
  const authMessage = error => ({ invalid_credentials:'이메일 또는 비밀번호가 맞지 않습니다.',
    xdr_brute_force:'로그인 실패가 반복돼 접근이 잠시 제한됐습니다. 최대 15분 뒤 다시 시도해 주세요.',
    email_not_confirmed:'가입 확인 이메일의 링크를 먼저 눌러 주세요.',
    over_email_send_rate_limit:'확인 이메일 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.',
    weak_password:'더 긴 비밀번호를 입력해 주세요.', signup_disabled:'현재 새 계정 가입이 비활성화돼 있습니다.' }[error.code] || '인증 요청에 실패했습니다. 입력 내용과 연결 상태를 확인해 주세요.');
  let client, signedIn = false, signup = false, editingId = null, revision = 0;
  function clearEditor() { editingId = null; $('#editor').reset(); $('#editor-title').textContent='메모 추가'; $('#save-note').textContent='메모 추가'; $('#cancel-edit').hidden=true; }
  async function api(path = '', options = {}) {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.');
    const response = await fetch('/api/notes'+path, { ...options, cache:'no-store',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+data.session.access_token } });
    const body = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? '로그인이 만료됐습니다. 다시 로그인해 주세요.'
      : response.status === 403 && body.error === 'XDR_BRUTE_FORCE' ? '로그인 실패가 반복돼 접근이 잠시 제한됐습니다. 최대 15분 뒤 다시 시도해 주세요.'
      : response.status === 404 ? '메모를 찾을 수 없습니다. 목록을 새로고침해 주세요.'
      : response.status === 409 ? '같은 메모 ID가 이미 있습니다.'
      : '자료 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return body;
  }
  async function loadNotes() {
    const current = revision;
    $('#notes').setAttribute('aria-busy','true');
    try {
      const notes = await api();
      if (current !== revision || !signedIn) return;
      if (!Array.isArray(notes)) throw new Error('자료 형식이 맞지 않습니다.');
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
      if(!items.length){const item=document.createElement('li'); item.textContent='아직 내 메모가 없습니다. 위에서 첫 메모를 추가하세요.';items.push(item);}
      $('#notes').replaceChildren(...items);
      status('내 메모를 불러왔습니다.');
    } catch(error){if(current===revision) status(error.message);}
    finally { $('#notes').setAttribute('aria-busy','false'); }
  }
  function updateSession(session) {
    revision++; signedIn=Boolean(session);
    if ($('#auth-form').dataset.recovery==='true') {
      $('#auth-panel').hidden=false; $('#workspace').hidden=true;
      $('#auth-title').textContent='새 비밀번호 설정'; $('#auth-submit').textContent='비밀번호 저장';
      $('#email').required=false; $('#password').autocomplete='new-password';
      $('#notes').replaceChildren(); status('새 비밀번호를 입력해 저장해 주세요.'); return;
    }
    $('#auth-panel').hidden=signedIn; $('#workspace').hidden=!signedIn;
    $('#password').value=''; $('#notes').replaceChildren(); clearEditor();
    status(signedIn?'로그인됐습니다. 내 메모를 불러옵니다.':'로그인하면 내 메모를 읽고 쓸 수 있습니다.');
    if(signedIn) void loadNotes();
  }
  try {
    const config=await(await fetch('/auth-config.json')).json();
    client=window.supabase.createClient(config.url,'auth-via-server',{global:{fetch:(target,options)=>{
      const url=new URL(target);
      if(url.origin!==new URL(config.url).origin || !url.pathname.startsWith('/auth/v1/')) throw new Error('AUTH_ROUTE_ONLY');
      const proxy=new URL('/api/auth',location.origin);
      proxy.search=url.search; proxy.searchParams.set('path',url.pathname.slice('/auth/v1/'.length));
      return fetch(proxy,options);
    }}});
    client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY') {status('비밀번호 재설정 링크가 확인됐습니다. 새 비밀번호를 입력해 주세요.'); $('#auth-panel').hidden=false; $('#workspace').hidden=true; $('#auth-title').textContent='새 비밀번호 설정'; $('#auth-submit').textContent='비밀번호 저장'; $('#email').required=false; $('#auth-form').dataset.recovery='true'; return;}
      if(event !== 'TOKEN_REFRESHED') setTimeout(()=>updateSession(session),0);
    });
    const {data,error}=await client.auth.getSession(); if(error)throw error; updateSession(data.session);
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
      if(recovery){delete $('#auth-form').dataset.recovery;updateSession((await client.auth.getSession()).data.session);}
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
  $('#logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)status('로그아웃에 실패했습니다. 다시 시도해 주세요.');else updateSession(null);});
  $('#editor').addEventListener('submit',async event=>{
    event.preventDefault(); $('#save-note').disabled=true;
    try {await api(editingId?'/'+editingId:'',{method:editingId?'PUT':'POST',body:JSON.stringify({title:$('#note-title').value,body:$('#note-body').value})});clearEditor();await loadNotes();status('메모를 저장했습니다.');}
    catch(error){status(error.message);}finally{$('#save-note').disabled=false;}
  });
  $('#cancel-edit').addEventListener('click',clearEditor);
  $('#refresh').addEventListener('click',loadNotes);
  $('#note-body').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')$('#editor').requestSubmit();});
  window.addEventListener('beforeunload', event => {
    if (signedIn && ($('#note-title').value || $('#note-body').value)) {
      event.preventDefault(); event.returnValue = '';
    }
  });
})();
