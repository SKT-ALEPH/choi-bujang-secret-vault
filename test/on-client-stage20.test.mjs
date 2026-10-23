import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudentView} from '../on-client/student/extension.mjs';
import {normalizeScan} from '../on-client/public/vulnerabilities-view.mjs';
class Element {
  children=[]; attributes={};
  constructor(tag){this.tagName=tag;}
  append(...nodes){this.children.push(...nodes);}
  set textContent(value){this.children=[String(value)];}
  get textContent(){return this.children.map(n=>typeof n==='string'?n:n.textContent).join(' ');}
  setAttribute(key,value){this.attributes[key]=String(value);}
}
const walk=node=>[node,...node.children.filter(n=>n instanceof Element).flatMap(walk)];
test('20: exact versions/source/timestamps, preserved partial findings, honest missing results and replacement',()=>{
  const previous=globalThis.document; globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const view=createStudentView();
    const time='2026-10-23T08:00:00.000Z', source='https://api.osv.dev/v1/querybatch';
    const pkg={name:'fixture-package',version:'1.2.3',source,checkedAt:time,status:'unverifiable',vulnerabilities:[{id:'TEST-20-FINDING',modified:'2026-10-22T08:00:00.000Z'}]};
    const data={status:'partial',lockfileVersion:3,lockfileHash:'a'.repeat(64),checkedAt:time,excluded:{count:0},packages:[pkg]};
    const before=JSON.stringify(data);
    const rendered=view.renderVulnerabilities({status:'ok',mode:'demo',data});
    for(const item of ['partial','fixture-package','1.2.3',source,time,'TEST-20-FINDING','2026-10-22T08:00:00.000Z','일부 확인·전체 조회 확인 불가','a'.repeat(64)])assert.ok(rendered.textContent.includes(item),item);
    const row=walk(rendered).find(n=>n.attributes['data-student-package-name']);
    assert.equal(row.attributes['data-student-package-name'],pkg.name);
    assert.equal(row.attributes['data-student-package-version'],'1.2.3');
    for(const status of ['idle','loading','error']){
      const out=view.renderVulnerabilities({status,data,error:{code:'TIMEOUT',message:'조회 시간 초과'}});
      assert.doesNotMatch(out.textContent,/fixture-package|TEST-20-FINDING|aaaaaaaa/);
      assert.equal(walk(out).filter(n=>n.attributes['data-student-package-name']).length,0);
      if(status==='error')assert.match(out.textContent,/조회 실패.*TIMEOUT.*조회 시간 초과/);
    }
    for(const [status,label] of [['complete','모두 조회'],['partial','일부 조회 실패'],['not_checked','아직 조회 안 함'],['not_configured','프로젝트 설정 필요'],['unverifiable','lock 파일 확인 불가']]){
      const out=view.renderVulnerabilities({status:'ok',data:{status,checkedAt:time,packages:[]}});
      assert.ok(out.textContent.includes(label),status);assert.ok(out.textContent.includes(status));
      assert.doesNotMatch(out.textContent,/lockfileVersion:|lockfileHash:|undefined/,'optional metadata never fabricated');
    }
    for(const status of ['known_vulnerabilities','none_found','unverifiable']){
      const out=view.renderVulnerabilities({status:'ok',data:{...data,packages:[{...pkg,status,vulnerabilities:status==='none_found'?[]:pkg.vulnerabilities}]}});
      assert.ok(out.textContent.includes(status));
      if(status==='none_found')assert.match(out.textContent,/조회 시점과 조회 범위.*안전을 보장하지 않습니다/);
      if(status!=='none_found')assert.match(out.textContent,/TEST-20-FINDING/);
    }
    const newData={...data,lockfileHash:'b'.repeat(64),packages:[{...pkg,version:'2.0.1'}]};
    const replaced=view.renderVulnerabilities({status:'ok',data:newData});
    assert.match(replaced.textContent,/2\.0\.1/);assert.doesNotMatch(replaced.textContent,/1\.2\.3|aaaaaaaa/);
    assert.equal(walk(replaced).find(n=>n.attributes['data-student-package-name']).attributes['data-student-package-version'],'2.0.1');
    assert.equal(normalizeScan({...data,packages:[{...pkg,version:'^1.2.0'}]}),null,'provided boundary rejects ranges');
    assert.equal(JSON.stringify(data),before);
    assert.ok(walk(rendered).every(n=>['section','p','ul','li'].includes(n.tagName)),'text DOM only, no query buttons');
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
