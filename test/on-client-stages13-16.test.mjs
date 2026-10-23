import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import {createStudentView} from '../on-client/student/extension.mjs';

// Isolated DOM model: no network, real accounts, storage or browser globals.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.listeners = {}; this.value = ''; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  set textContent(value) { this.children = [String(value)]; }
  get textContent() { return this.children.map(n => typeof n === 'string' ? n : n.textContent).join(' '); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  fire(type) { return this.listeners[type]?.({target: this, currentTarget: this}); }
}
globalThis.document = {createElement: tag => new Element(tag)};
const view = createStudentView();
const ok = data => ({status: 'ok', mode: 'demo', data});
const input = {
  me: ok({user: {id: 'u-old', label: '<img src=x onerror=alert(1)>'}, device: {id: 'd1', label: '기기 A', status: 'noncompliant'}, session: {id: 's1', status: 'expired'}}),
  devices: ok([{id: 'd2', label: '기기 B', status: 'unknown'}]),
  sessions: ok([{id: 's2', status: 'revoked'}]),
};
const text = view.renderIdentity(input).textContent;
for (const wanted of ['u-old', '<img src=x onerror=alert(1)>', '기기 A', 'd1', '보안 기준 미충족', 'expired', '만료', 'd2', '확인 불가', 's2', '철회됨', '예제 자료']) assert.ok(text.includes(wanted), wanted);
const next = structuredClone(input); next.me.data.user = {id: 'u-new', label: '새 사용자'};
const newText = view.renderIdentity(next).textContent;
assert.ok(newText.includes('u-new')); assert.ok(!newText.includes('u-old'));
for (const mode of ['demo', 'disconnected', 'unknown']) {
  for (const status of ['loading', 'error']) {
    const r = {status, mode, data: input.me.data, error: {code: 'CONTRACT_MISMATCH', message: '응답 형식 검사 실패'}};
    const result = view.renderIdentity({me: r, devices: r, sessions: r}).textContent;
    assert.ok(!result.includes('u-old'));
    assert.ok(result.includes(status === 'loading' ? '불러오는 중' : '응답 형식 검사 실패'));
    assert.ok(result.includes({demo:'예제 자료', disconnected:'연결 없음', unknown:'확인 불가'}[mode]));
  }
}
const independent = view.renderIdentity({...input, devices: {status:'error', mode:'disconnected', error:{message:'기기 조회 실패'}}}).textContent;
assert.ok(independent.includes('기기 조회 실패')); assert.ok(independent.includes('현재 계정'));
const empty = view.renderIdentity({...input, devices:ok([]), sessions:ok([])}).textContent;
assert.ok(empty.includes('등록된 기기가 없습니다')); assert.ok(empty.includes('현재 연결이 없습니다'));
console.log('stage13: identity states, modes, replacement, safe text, independent failures and empty lists passed');

if (Number(process.argv[2] ?? 16) >= 14) {
  for (const decision of ['allow', 'deny', 'challenge', 'unknown', 'new-server-value']) {
    const result = view.renderDecision({status:'ok', mode:'demo', data:{appId:'app-A', decision, reason:'<b>원천 사유</b>', checkedAt:'2026-10-19T10:00:00.000Z'}}).textContent;
    for (const expected of ['app-A', '<b>원천 사유</b>', '2026-10-19T10:00:00.000Z', decision==='new-server-value'?'unknown':decision]) assert.ok(result.includes(expected));
    if (decision==='new-server-value'||decision==='unknown') assert.ok(result.includes('확인 불가'));
  }
  for (const status of ['idle','loading','error']) {
    const result=view.renderDecision({status, mode:'disconnected', appId:'app-A', data:{decision:'allow',reason:'old-reason'},error:{message:'원천 연결 실패'}}).textContent;
    assert.ok(!result.includes('old-reason'));
    assert.ok(result.includes({idle:'접속을 요청',loading:'판정 확인 중',error:'판정 요청 실패'}[status]));
    if(status==='error')assert.ok(result.includes('요청 실패는 접근 거부 판정과 다릅니다'));
  }
  console.log('stage14: four decisions, unexpected value, source reason/time, stale result removal and error/deny distinction passed');
}

function nodes(root) { return [root,...root.children.filter(n => n instanceof Element).flatMap(nodes)]; }
if (Number(process.argv[2] ?? 16) >= 15) {
  const event = (id, kind, appId, at, access) => ({id,kind,appId,at,summary:`요약 <b>${id}</b>`,evidence:[{id:'e-'+id,text:'근거 <script>원문</script>'}],rules:[{id:'r-'+id,text:'규칙 설명'}],state:{access,session:'expired',device:'unknown'},supportedActions:[]});
  const records = [event('early','access','app-A','2026-10-19T01:00:00.000Z','allowed'),event('latest','xdr','app-B','2026-10-19T03:00:00.000Z','denied'),event('middle','access',null,'2026-10-19T02:00:00.000Z','unknown')];
  const original=JSON.stringify(records);
  const root=view.renderEvents(ok(records));
  const rows=()=>nodes(root).filter(n=>n.getAttribute('data-student-event-id')!==null);
  assert.deepEqual(rows().map(n=>n.getAttribute('data-student-event-id')),['latest','middle','early']);
  assert.equal(JSON.stringify(records),original);
  const controls=nodes(root).filter(n=>n.tagName==='select');
  assert.deepEqual(controls.map(n=>n.getAttribute('aria-label')),['기록 종류','업무 앱','접속 상태']);
  const detailButton=nodes(root).find(n=>n.tagName==='button'&&n.textContent==='latest 상세');
  detailButton.fire('click');
  const detail=nodes(root).find(n=>n.getAttribute('data-student-event-detail')==='latest');
  for(const required of ['latest','app-B','e-latest','근거 <script>원문</script>','r-latest','denied','expired','unknown','확인 불가'])assert.ok(detail.textContent.includes(required),required);
  for (const [index,value,ids] of [[0,'xdr',['latest']],[0,'access',['middle','early']],[1,'app-A',['early']],[2,'denied',[]]]) {
    controls[index].value=value;controls[index].fire('change');
    assert.deepEqual(rows().map(n=>n.getAttribute('data-student-event-id')),ids);
    assert.ok(!nodes(root).some(n=>n.getAttribute('data-student-event-detail')));
  }
  assert.ok(view.renderEvents(ok([])).textContent.includes('표시할 기록이 없습니다'));
  const failed=view.renderEvents({status:'error',mode:'unknown',data:records,error:{code:'CONTRACT_MISMATCH',message:'형식 확인 불가'}});
  assert.ok(failed.textContent.includes('기록을 불러오지 못했습니다'));assert.ok(!failed.textContent.includes('latest'));
  assert.ok(!nodes(failed).some(n=>n.getAttribute('data-student-event-id')));
  assert.ok(!nodes(root).some(n=>n.tagName==='script'||n.tagName==='b'));
  assert.equal(nodes(root).filter(n=>n.tagName==='button').length,0);
  console.log('stage15: immutable latest-first records, three local filters, exact row/detail IDs, evidence/rules/states, replacement and empty/error distinction passed');
}

if (Number(process.argv[2] ?? 16) >= 16) {
  let networkCalls=0, copies=[];
  globalThis.fetch=()=>{networkCalls++;throw Error('Unexpected network call');};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copies.push(text);}}}});
  const sentinel=randomUUID(); // Ephemeral forbidden field used only by this synthetic DOM check.
  const diagnostics=ok({requestId:'request-16',component:'on-client',version:'0.2.11',checkedAt:'2026-10-19T10:00:00.000Z',engine:{mode:'demo',code:'DEMO_ONLY',secret:sentinel},token:sentinel,password:sentinel});
  const statusInput={mode:'demo',devices:ok([{id:'device-16',label:'점검 기기',status:'noncompliant'}]),sessions:ok([{id:'session-16',status:'expired'}]),notifications:[{resource:'devices',code:'DEVICE_FAILURE',message:'기기 연결 상태를 확인하세요.'}],diagnostics};
  const root=view.renderStatus(statusInput);
  for(const value of ['점검 기기','noncompliant','보안 기준 미충족','session-16','expired','만료','devices','DEVICE_FAILURE','기기 연결 상태를 확인','request-16','on-client','0.2.11','DEMO_ONLY','도움 요청'])assert.ok(root.textContent.includes(value),value);
  assert.ok(!root.textContent.includes(sentinel));
  const copy=nodes(root).find(n=>n.tagName==='button'&&n.textContent==='도움정보 복사');
  assert.ok(copy);assert.equal(copy.disabled,false);assert.equal(copies.length,0);
  await copy.fire('click');assert.equal(copies.length,1);
  const copied=JSON.parse(copies[0]);
  assert.deepEqual(Object.keys(copied).sort(),['checkedAt','component','engine','requestId','version']);
  assert.deepEqual(Object.keys(copied.engine).sort(),['code','mode']);
  assert.ok(!copies[0].includes(sentinel));
  const malformed=view.renderStatus({...statusInput,diagnostics:ok({...diagnostics.data,requestId:{token:sentinel}})});
  await nodes(malformed).find(n=>n.tagName==='button'&&n.textContent==='도움정보 복사').fire('click');
  assert.ok(!copies.at(-1).includes(sentinel));
  assert.equal(JSON.parse(copies.at(-1)).requestId,'확인 불가');
  const empty=view.renderStatus({...statusInput,devices:ok([]),sessions:ok([]),notifications:[]});
  assert.ok(empty.textContent.includes('등록된 기기가 없습니다'));assert.ok(empty.textContent.includes('현재 연결이 없습니다'));assert.ok(empty.textContent.includes('주의할 알림이 없습니다'));
  const loading=view.renderStatus({...statusInput,devices:{status:'loading',mode:'demo',data:[{label:'오래된 기기'}]}});
  assert.ok(loading.textContent.includes('불러오는 중'));assert.ok(!loading.textContent.includes('오래된 기기'));
  const timeout=view.renderStatus({...statusInput,devices:{status:'error',mode:'disconnected',error:{code:'ENGINE_TIMEOUT',message:'응답을 받지 못했습니다.'}}});
  for(const value of ['기기 정보 조회 실패','시간 초과','직접 누르세요','연결 상태를 확인'])assert.ok(timeout.textContent.includes(value));
  assert.ok(!view.renderStatus(statusInput).textContent.includes('시간 초과'));
  const diagError=view.renderStatus({...statusInput,diagnostics:{status:'error',error:{message:'진단 서비스 중지'}}});
  assert.equal(nodes(diagError).find(n=>n.tagName==='button'&&n.textContent==='도움정보 복사').disabled,true);
  const record={id:'unsupported-16',kind:'xdr',at:'2026-10-19T00:00:00.000Z',appId:null,summary:'기록',evidence:[],rules:[],state:{access:'unknown',session:'unknown',device:'unknown'},supportedActions:['revoke_session']};
  const events=view.renderEvents(ok([record]));
  nodes(events).find(n=>n.tagName==='button'&&n.textContent==='unsupported-16 상세').fire('click');
  const detail=nodes(events).find(n=>n.getAttribute('data-student-event-detail')==='unsupported-16');
  const unsupported=nodes(detail).find(n=>n.tagName==='button'&&n.textContent==='revoke_session 미지원');
  assert.ok(unsupported);assert.equal(unsupported.disabled,true);assert.ok(detail.textContent.includes('아직 지원하지 않는 조치'));
  unsupported.fire('click');assert.equal(networkCalls,0);
  console.log('stage16: independent loading/empty/error, timeout/recovery, notifications, diagnostic allowlist and manual copy, disabled in-detail actions and zero network requests passed');
}
