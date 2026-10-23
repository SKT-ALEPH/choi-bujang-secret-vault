import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createStudentView} from '../on-client/student/extension.mjs';

// Renderer contract only: no AI transport, account, storage, or real-model claims.
class Element {
  children = [];
  attributes = {};
  constructor(tag) { this.tagName = tag; }
  append(...nodes) { this.children.push(...nodes); }
  set textContent(value) { this.children = [String(value)]; }
  get textContent() { return this.children.map(n => typeof n === 'string' ? n : n.textContent).join(' '); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
}

test('17단계 연결 상태·오류 복구와 설명 성공의 사건 귀속을 구분한다', () => {
  const previous = globalThis.document;
  globalThis.document = {createElement: tag => new Element(tag)};
  try {
    const view = createStudentView();
    const input = {mode:'demo', checkedAt:'2026-10-23T00:00:00.000Z',
      data:{transportChecked:true,audienceAuthorization:'verified',modelCount:3,rawError:'EXTRA_PRIVATE_VALUE'},
      error:{code:'WB_CLCO_AUTH_REQUIRED',message:'이전 인증 오류'}};
    for (const status of ['idle','loading']) {
      const result = view.renderAiConnection({...input,status}).textContent;
      assert.match(result, status === 'idle' ? /점검 전/u : /점검 중/u);
      assert.doesNotMatch(result, /이전 인증 오류|응답 모델 수: 3/u);
    }
    for (const [code,expected] of [
      ['ON_AI_PROVISIONING_PENDING','권한 준비'], ['ON_AI_AUTHORIZATION_CHANGED','앱 권한'],
      ['WB_CLCO_AUTH_REQUIRED','인증 실패'], ['WB_CLCO_ACCESS_BLOCKED','접근이 제한'],
      ['WB_CLCO_COHORT_BUDGET_EXHAUSTED','반 사용량'], ['WB_CLCO_LIMIT_REACHED','이용 한도'],
      ['WB_CLCO_SESSION_CLOSED','이용 시간'], ['WB_CLCO_RATE_LIMITED','직접 다시 점검'],
      ['WB_CLCO_TIMEOUT','시간 초과'], ['TIMEOUT','시간 초과'], ['WB_CLCO_NETWORK_ERROR','네트워크'],
      ['CANCELLED','취소'], ['WB_CLCO_CANCELLED','취소'],
      ['MODEL_NOT_CONFIGURED','모델 허용 설정'], ['ON_AI_MODEL_LIST_EMPTY','모델 허용 설정'],
      ['AI_REQUEST_UNVERIFIED','담당자'],
    ]) {
      const result = view.renderAiConnection({...input,status:'error',error:{code,message:'안전한 메시지'}});
      for (const wanted of [code,'안전한 메시지',expected]) assert.ok(result.textContent.includes(wanted), code+' '+wanted);
      assert.doesNotMatch(result.textContent,/응답 모델 수: 3|EXTRA_PRIVATE_VALUE/u);
      assert.ok(result.children.some(n => n.attributes.role === 'alert'));
    }
    for (const audienceAuthorization of ['test','verified']) {
      const result = view.renderAiConnection({...input,status:'ok',data:{...input.data,audienceAuthorization}}).textContent;
      for (const wanted of [audienceAuthorization,'모델 수: 3',input.checkedAt,'사건 설명은 아직 실행하지 않았습니다','예제 자료','직접 누르세요']) assert.ok(result.includes(wanted),wanted);
      assert.doesNotMatch(result,/이전 인증 오류|EXTRA_PRIVATE_VALUE/u);
    }
    const event = {id:'event-17', evidence:[{id:'e-17',text:'가상 근거'}], rules:[{id:'r-17',text:'가상 규칙'}], state:{}, supportedActions:[]};
    const explanation = {status:'ok',data:{summary:'<script>문자 그대로</script>',evidenceIds:['e-17'],proposals:[],executed:false,requiresHumanConfirmation:true,rawError:'EXTRA_PRIVATE_VALUE'}};
    const success = view.renderExplanation({event,explanation,checkedAt:input.checkedAt});
    assert.equal(success.attributes['data-student-explanation-event'],event.id);
    assert.match(success.textContent,/<script>문자 그대로<\/script>/u);
    assert.ok(success.children.every(n => n.tagName === 'p'));
    for (const status of ['idle','loading','error']) {
      const result = view.renderExplanation({event,explanation:{...explanation,status,error:{code:'CANCELLED',message:'요청 취소'}}});
      assert.equal(result.attributes['data-student-explanation-event'],undefined);
      assert.doesNotMatch(result.textContent, /문자 그대로|EXTRA_PRIVATE_VALUE/u);
      if (status === 'error') for (const wanted of ['CANCELLED','요청 취소','기존 기록은 그대로']) assert.ok(result.textContent.includes(wanted));
    }
    assert.match(view.renderExplanation({event:null,explanation}).textContent,/먼저 선택/u);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
