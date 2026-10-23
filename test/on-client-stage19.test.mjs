import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentView} from '../on-client/student/extension.mjs';
class Element {
  children=[]; attributes={};
  constructor(tag){this.tagName=tag;}
  append(...nodes){this.children.push(...nodes);}
  set textContent(value){this.children=[String(value)];}
  get textContent(){return this.children.map(n=>typeof n==='string'?n:n.textContent).join(' ');}
  setAttribute(key,value){this.attributes[key]=String(value);}
}
test('19: ACK is pending, only observed effect is succeeded; current intent/replay/reset remain distinct',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const view=createStudentView();
    const input={event:{id:'event-a',evidence:[{id:'evidence-a',text:'가상 근거'}],supportedActions:['review']},actionId:'review',
      target:{id:'subject:fixture-a',generation:7},receipt:{requestId:'request-a',receiptId:'receipt-a',eventId:'event-a',actionId:'review',status:'pending',version:3,replayed:false},
      confirmationExpiresAt:'2026-10-23T09:00:00.000Z',message:'가상 서버 상태',error:{code:'ACTION_TIMEOUT',message:'현재 결과 확인 불가'}};
    const before=JSON.stringify(input);
    for(const [status,expected] of [['idle','아직 미실행'],['loading','결과 조회 중'],['prepared','준비됨·미실행'],['executing','서버에 전달 중'],['pending','서버 접수·처리 중'],['denied','거절'],['failed','실패'],['unknown','결과 불명'],['expired','확인 기한 지남'],['error','요청이 처리되지 않았습니다']]){
      const out=view.renderAction({...input,status});
      assert.ok(out.textContent.includes(expected),status);
      assert.ok(out.textContent.includes(`(${status})`),status+' raw status');
      for(const item of ['event-a','evidence-a','review','subject:fixture-a','7','request-a','receipt-a','version: 3'])assert.ok(out.textContent.includes(item),item);
      assert.equal(out.attributes['data-student-action-event'],'event-a');
      assert.equal(out.attributes['data-student-action-request'],'request-a');
      assert.doesNotMatch(out.textContent,/효과 확인\(succeeded\)|effectApplied: true/);
      assert.ok(out.children.every(n=>n.tagName==='p'),'display only, no execution buttons');
      if(status==='prepared')assert.ok(out.textContent.includes(input.confirmationExpiresAt));
      if(status==='pending')assert.match(out.textContent,/ACK.*실제 효과를 뜻하지 않습니다/);
      if(status==='unknown')assert.match(out.textContent,/효과 없음으로 판단하지.*결과만 직접 재조회/);
    }
    for(const observation of [null,{effectApplied:false},{effectApplied:'true'}]){
      const out=view.renderAction({...input,status:'succeeded',observation});
      assert.match(out.textContent,/결과 불명\(unknown\)/);
      assert.doesNotMatch(out.textContent,/효과 확인\(succeeded\)|effectApplied: true/);
    }
    const success=view.renderAction({...input,status:'succeeded',observation:{effectApplied:true,observedAt:'2026-10-23T08:45:00.000Z'},error:null,receipt:{...input.receipt,status:'succeeded',replayed:true}});
    for(const item of ['효과 확인(succeeded)','effectApplied: true','2026-10-23T08:45:00.000Z','receipt-a','replayed: true','새로 집행한 결과가 아닙니다'])assert.ok(success.textContent.includes(item),item);
    const mismatched=view.renderAction({...input,status:'succeeded',observation:{effectApplied:true},receipt:{...input.receipt,eventId:'other-event'}});
    assert.match(mismatched.textContent,/결과 불명.*일치하지 않아/);
    assert.equal(mismatched.attributes['data-student-action-request'],undefined);
    assert.doesNotMatch(mismatched.textContent,/효과 확인\(succeeded\)/);
    const reset=view.renderAction({status:'idle',event:null,target:null,receipt:null,observation:null,message:'화면 취소'});
    assert.equal(reset.attributes['data-student-action-event'],undefined);
    assert.equal(reset.attributes['data-student-action-request'],undefined);
    assert.doesNotMatch(reset.textContent,/event-a|receipt-a|subject:fixture-a|request-a/);
    assert.match(reset.textContent,/이미 전달된 조치 효과를 되돌리지 않습니다/);
    assert.equal(JSON.stringify(input),before,'rendering cannot mutate the current intent');
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
