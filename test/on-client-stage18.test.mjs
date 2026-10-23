import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentView} from '../on-client/student/extension.mjs';

// Rendering contract; fixtures are synthetic, not model or SDP evidence.
class Element {
  children = []; attributes = {};
  constructor(tag) { this.tagName = tag; }
  append(...nodes) { this.children.push(...nodes); }
  set textContent(value) { this.children = [String(value)]; }
  get textContent() { return this.children.map(n => typeof n === 'string' ? n : n.textContent).join(' '); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
}

test('18: bind explanation to current evidence, preserve unknown and reject invalid/stale success', () => {
  const previous = globalThis.document;
  globalThis.document = {createElement: tag => new Element(tag)};
  try {
    const view = createStudentView();
    const event = id => ({id, evidence:[{id:`ev-${id}`,text:`${id} 원천 근거 <img onerror=alert(1)>`}],
      rules:[{id:`rule-${id}`,text:`${id} 접근 규칙`}], state:{access:'unknown',session:'unknown',device:'unknown'}, supportedActions:[]});
    const explanation = id => ({status:'ok', data:{summary:`${id} 참고 요약`,evidenceIds:[`ev-${id}`],proposals:[],requiresHumanConfirmation:true,executed:false}});
    const render = (e, x) => view.renderExplanation({event:e,explanation:x,checkedAt:'2026-10-23T08:00:00.000Z'});
    const a=event('a'), b=event('b'), xa=explanation('a'), xb=explanation('b');
    const before=JSON.stringify({a,b,xa,xb});
    const outputA=render(a,xa), outputB=render(b,xb);
    assert.equal(outputA.attributes['data-student-explanation-event'],'a');
    assert.equal(outputB.attributes['data-student-explanation-event'],'b');
    for (const item of ['b 참고 요약','ev-b','b 원천 근거','rule-b','b 접근 규칙','AI 설명(참고용)',
      '접속: 확인 불가(unknown)','세션: 확인 불가(unknown)','기기: 확인 불가(unknown)','지원하는 조치가 없어 제안이 없습니다']) assert.ok(outputB.textContent.includes(item),item);
    assert.doesNotMatch(outputB.textContent,/a 참고 요약|ev-a|rule-a/);
    assert.ok(outputA.children.every(n=>n.tagName==='p'), 'no HTML parsing or execution buttons');
    assert.match(outputA.textContent,/<img onerror=alert\(1\)>/);
    const rejected = [
      render(b,xa),
      render({...a,evidence:[]},xa),
      render({...a,rules:[]},xa),
      render(a,{...xa,data:{...xa.data,executed:true}}),
      render(a,{...xa,data:{...xa.data,requiresHumanConfirmation:false}}),
      render(a,{...xa,data:{...xa.data,evidenceIds:['ev-a','ev-a']}}),
      render(a,{...xa,data:{...xa.data,proposals:[{action:'revoke',evidenceIds:['ev-a'],reason:'unavailable'}]}}),
      render(null,{status:'error',error:{code:'ON_AI_INVALID_INPUT',message:'사건 근거 부족'}}),
    ];
    for(const result of rejected) {
      assert.equal(result.attributes['data-student-explanation-event'],undefined);
      assert.match(result.textContent,/AI 설명 실패/);
      assert.match(result.textContent,/기존 기록은 그대로/);
      assert.doesNotMatch(result.textContent,/a 참고 요약/);
    }
    assert.match(rejected.at(-1).textContent,/ON_AI_INVALID_INPUT.*사건 근거 부족/);
    for(const status of ['idle','loading','error']) {
      const result=render(a,{...xa,status,error:{code:'CANCELLED',message:'취소됨'}});
      assert.equal(result.attributes['data-student-explanation-event'],undefined);
      assert.doesNotMatch(result.textContent,/a 참고 요약|ev-a|rule-a/);
    }
    assert.match(render(null,{status:'idle'}).textContent,/먼저 선택/);
    const proposal={action:'review',evidenceIds:['ev-a'],reason:'가상 검토 이유'};
    const proposed=render({...a,supportedActions:['review']},{...xa,data:{...xa.data,proposals:[proposal]}});
    for(const item of ['review','가상 검토 이유','사람 확인이 필요하며 실행되지 않았습니다','ev-a']) assert.ok(proposed.textContent.includes(item));
    const noUnknown=render({...a,state:{access:'denied',session:'active',device:'compliant'},supportedActions:['review']},xa);
    assert.match(noUnknown.textContent,/확인 불가 상태 없음/);
    assert.match(noUnknown.textContent,/AI가 제안한 조치가 없습니다/);
    assert.equal(JSON.stringify({a,b,xa,xb}),before,'rendering must not mutate source records');
    assert.equal(view.renderDecision({status:'ok',mode:'demo',data:{decision:'deny',appId:'app-a',reason:'원래 판정',checkedAt:'2026-10-23T08:00:00.000Z'}}).attributes['data-decision'],'deny');
  } finally {
    if(previous===undefined) delete globalThis.document; else globalThis.document=previous;
  }
});
