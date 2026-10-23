import {renderReadable} from './readable.mjs';
const $ = id => document.getElementById(`personal-${id}`);
let session, models = [], busy = false, epoch = 0, statusEpoch = 0, controller, poll, operation;
const sessionNames = {disconnected: 'ChatGPT 연결 전', connecting: '로그인 진행 중', connected: 'ChatGPT 연결됨', reauth_required: '다시 로그인 필요'};
const example = '[학습용 가상 사례] 같은 출발지에서 2분 동안 비밀번호 로그인 실패가 25회 관측됐습니다. 이 기록으로 무엇을 의심할 수 있고, 무엇은 아직 알 수 없는지 설명해 주세요.';
function output(message, state = '대기 중') {
  $('empty').hidden = !!message;
  $('output').hidden = !message;
  $('response-status').textContent = state;
  $('response-meta').hidden = true;
  $('output').removeAttribute('data-personal-explanation-input');
  if (message) renderReadable(document, $('output'), message);
  else $('output').replaceChildren();
}

async function api(path, body, signal) {
  const response = await fetch(`/personal-ai/${path}`, body === undefined ? {signal} : {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw result.error ?? {code: 'unverified', message: '현재 결과를 확인할 수 없습니다.'};
  return result;
}
function error(value) {
  $('error').hidden = !value;
  $('error').textContent = value ? `${value.message ?? '현재 결과를 확인할 수 없습니다.'} (${value.code ?? 'unverified'})` : '';
  if (value) $('empty').hidden = true;
}
function controls(loginPending = false) {
  const connected = session?.status === 'connected' && session.sharing;
  document.getElementById('personal-ai-card').setAttribute('aria-busy', String(busy));
  $('model').disabled = !connected || !models.length || busy;
  $('models').disabled = !connected || busy || loginPending;
  $('check').disabled = !connected || !$('model').value || busy || loginPending;
  $('explain').disabled = !connected || !$('model').value || !$('input').value.trim() || busy || loginPending;
  $('input').disabled = busy;
  $('example').disabled = busy;
  $('login').disabled = busy || loginPending;
  $('login').hidden = connected || loginPending;
  $('add').disabled = busy || loginPending;
  $('add').hidden = !session?.profileId || loginPending;
  $('disconnect').disabled = !session?.profileId || loginPending;
  $('profile').disabled = !Array.from($('profile').options).some(option => option.value) || loginPending || busy;
  $('signin-cancel').disabled = !loginPending;
  $('signin-cancel').hidden = !loginPending;
  $('cancel').disabled = !busy;
  $('cancel').hidden = !busy;
  $('explain').querySelector('span').textContent = busy && operation === 'explain' ? '설명하는 중…' : 'AI 설명받기';
  $('check').textContent = busy && operation === 'check' ? '응답 점검 중…' : '실제 응답 점검';
}
function reset() {
  epoch++; statusEpoch++; controller?.abort(); busy = false; models = [];
  $('model').replaceChildren(new Option('연결 후 모델을 선택하세요', ''));
  output(null);
  $('check-result').textContent = '아직 선택한 모델의 응답을 점검하지 않았습니다.';
  $('model-hint').textContent = '모델 목록을 불러온 뒤 사용할 모델을 직접 선택하세요.';
  error(null);
}
async function status() {
  clearTimeout(poll);
  const currentStatus = ++statusEpoch;
  try {
    const data = await api('status');
    if (currentStatus !== statusEpoch) return;
    if (session && (session.profileId !== data.session.profileId || session.status !== data.session.status || session.sharing !== data.session.sharing)) reset();
    session = data.session;
    const account = session.email ?? session.profileLabel ?? '';
    $('session').textContent = session.status === 'connected' && !session.sharing ? 'AI 이용 권한 없음' : sessionNames[session.status] ?? '연결 확인 불가';
    $('session').dataset.connected = String(session.status === 'connected' && session.sharing);
    $('account-name').textContent = account || 'OpenAI 공식 화면에서 계정을 연결하세요.';
    $('settings-caption').textContent = session.status === 'connected' && session.sharing ? '연결됨 · 계정 관리' : 'ChatGPT 연결 관리';
    if (session.status !== 'connected' || !session.sharing) $('settings').open = true;
    $('profile').replaceChildren(...data.profiles.map(p => new Option(`${p.label}${p.email ? ` · ${p.email}` : ''}`, p.id)));
    if (!data.profiles.length) $('profile').append(new Option('저장된 연결 없음', ''));
    $('profile').value = session.profileId ?? '';
    $('authorize').hidden = !data.authorizationReady;
    if (data.error) error(data.error);
    controls(data.loginPending);
    // Only observe the pending login. Never retry authorization or inference.
    if (data.loginPending) poll = setTimeout(status, 2000);
  } catch (value) { if (currentStatus === statusEpoch) { error(value); controls(); } }
}

async function signIn(newProfile) {
  reset(); busy = true; controls();
  $('session').textContent = 'OpenAI 로그인 화면을 준비하고 있습니다.';
  try {
    await api('login', newProfile ? {newProfile: true} : {});
  } catch (value) { error(value); }
  finally { busy = false; await status(); }
}
async function accountAction(path, body = {}) {
  reset(); busy = true; controls();
  try { await api(path, body); } catch (value) { error(value); }
  finally { busy = false; await status(); }
}
async function run(path) {
  if (busy) return;
  const generation = ++epoch;
  controller = new AbortController(); busy = true; operation = path; error(null); controls();
  if (path === 'models') {
    models = []; $('model').replaceChildren(new Option('모델 목록 확인 중', ''));
    $('models').textContent = '불러오는 중…'; $('model-hint').textContent = '현재 계정에서 사용할 수 있는 모델을 확인하고 있습니다.';
    $('check-result').textContent = '모델 목록 확인 중입니다. 이전 응답 점검 결과는 현재 결과가 아닙니다.';
    output(null);
  }
  else if (path === 'explain') output('기록을 읽고 설명을 정리하고 있습니다. 잠시만 기다려 주세요.', '설명 중');
  if (path === 'check') $('check-result').textContent = '실제 모델 응답을 점검하고 있습니다.';
  try {
    const data = await api(path, path === 'models' ? {} : {model: $('model').value, ...(path === 'explain' ? {text: $('input').value} : {})}, controller.signal);
    if (generation !== epoch) return;
    if (path === 'models') {
      models = data.models;
      $('model').replaceChildren(new Option('모델을 직접 선택하세요', ''), ...models.map(m => new Option(m.displayName, m.slug)));
      $('model-hint').textContent = `응답 모델 수 ${models.length}개 · ${new Date(data.checkedAt).toLocaleString('ko-KR')} · 모델을 선택해 주세요.`;
      $('check-result').textContent = '개인 OAuth로 모델 목록만 확인했습니다. 실제 응답 점검과 사건 설명은 아직 실행하지 않았습니다.';
      output(null, '준비 완료');
    } else {
      const checkedAt = new Date(data.checkedAt).toLocaleString('ko-KR');
      if (path === 'check') $('check-result').textContent = `개인 OAuth 실제 응답 확인 · ${$('model').selectedOptions[0].textContent} · ${checkedAt}. 연결 점검용 문장의 응답이며 사건 설명을 실행한 결과는 아닙니다.`;
      else {
        output(data.text, '설명 완료');
        $('output').setAttribute('data-personal-explanation-input', data.inputId);
        $('response-meta').textContent = `${$('model').selectedOptions[0].textContent} · ${checkedAt} · 수동 입력 ID: ${data.inputId}`;
        $('response-meta').hidden = false;
      }
    }
  } catch (value) {
    if (generation !== epoch) return;
    error(value); models = [];
    $('model').replaceChildren(new Option('모델 목록을 다시 불러오세요', ''));
    $('model-hint').textContent = '점검 실패. 모델 목록을 직접 다시 불러오세요. 이전 모델 수는 현재 결과가 아닙니다.';
    output('연결 상태와 입력을 확인한 뒤 다시 요청해 주세요. 기존 보안 기록과 판정은 변경하지 않았습니다.', '확인 필요');
    $('check-result').textContent = '점검 실패. 이전 점검 결과는 현재 결과가 아닙니다.';
  } finally { if (generation === epoch) { busy = false; $('models').textContent = models.length ? '목록 새로고침' : '모델 불러오기'; controls(); } }
}
$('login').addEventListener('click', () => signIn(false));
$('add').addEventListener('click', () => signIn(true));
$('signin-cancel').addEventListener('click', () => accountAction('signin-cancel'));
$('disconnect').addEventListener('click', () => accountAction('disconnect'));
$('profile').addEventListener('change', () => accountAction('profile', {profileId: $('profile').value}));
$('model').addEventListener('change', () => { $('check-result').textContent = '아직 선택한 모델의 응답을 점검하지 않았습니다.'; output(null, $('model').value ? '준비 완료' : '대기 중'); error(null); controls(); });
$('input').addEventListener('input', () => { $('count').textContent = `${$('input').value.length.toLocaleString('ko-KR')} / 6,000`; output(null, '입력 변경됨'); error(null); controls(); });
$('example').addEventListener('click', () => { $('input').value = example; $('input').dispatchEvent(new Event('input')); $('input').focus(); });
for (const path of ['models', 'check', 'explain']) $(path).addEventListener('click', () => run(path));
$('cancel').addEventListener('click', async () => {
  const generation = ++epoch;
  controller?.abort(); busy = true; operation = 'cancel'; models = [];
  $('model').replaceChildren(new Option('모델 목록을 다시 불러오세요', ''));
  $('model-hint').textContent = '요청 취소. 이전 모델 수는 현재 결과가 아닙니다. 직접 목록을 다시 불러오세요.';
  output('요청을 취소했습니다. 다시 요청할 때까지 이전 응답을 표시하지 않습니다.', '취소됨');
  $('check-result').textContent = '요청 취소. 이전 점검 결과는 현재 결과가 아닙니다.';
  error(null); controls();
  $('cancel').disabled = true;
  try { await api('cancel', {}); } catch (value) { if (generation === epoch) error(value); }
  finally { if (generation === epoch) { busy = false; $('models').textContent = '모델 불러오기'; controls(); } }
});
window.addEventListener('focus', () => { if (!busy) status(); });
status();
