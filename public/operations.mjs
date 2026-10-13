const labels={normal:'정상',forbidden:'금지',live_api_protocol:'실제 자료 API',synthetic_input_over_http:'가상 입력 · 실제 HTTP',public_http:'공개 경로 · 실제 HTTP'};
export function reportRows(report){return report.verification.records.map(r=>[
 String(r.stage),labels[r.type]??r.type,labels[r.kind]??r.kind,r.caseId,r.method+' '+r.path,
 String(r.expected),String(r.actual??'미실행'),r.result==='passed'?'확인':r.result==='failed'?'실패':'미실행',r.requestId??'없음',r.checkedAt??'미실행',
]);}
export function reportSummary(report){
 const v=report.verification,s=report.summary,a=v.fullAssault;
 return [
  `검사 커밋: ${v.testedCommit??'미실행'} · 검사 시각: ${v.at??'미실행'}`,
  `가린 서버 시험 기록: ${s.executed}건 실행 / ${s.passed}건 확인 / ${s.failed}건 실패 / ${s.notRun}건 미실행`,
  `판정 규칙 ${report.rules.length}개: ${report.rules.join(', ')}`,
  `탐지: 가상 입력 HTTP ${report.detection.records.length}건 · 운영 사건은 미측정`,
  `회수 후 자료 접근 거부: ${report.revocation.records.filter(r=>r.result==='passed').length}건 실측`,
  `복구 API 기록: ${report.recovery.records.length}건 · 안전 정책 ${report.policy.version} · 해시 검증 ${report.policy.verified?'확인':'실패'}`,
  `자체 41종 전체 시험: ${a.executed}/${a.total}종 실행 · ${a.status==='not_run'?'미실행':a.status} · 운영 심판 결과와 별도`,
 ];
}
export function renderReport(root,report,document){
 const summary=root.querySelector('#operations-summary'),body=root.querySelector('#operations-rows');
 summary.replaceChildren(...reportSummary(report).map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
 body.replaceChildren(...reportRows(report).map(row=>{const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
}
if(typeof document!=='undefined'){
 const root=document.querySelector('#operations'),status=root.querySelector('#operations-status'),button=root.querySelector('#operations-refresh');
 const refresh=async()=>{
  button.disabled=true;root.setAttribute('aria-busy','true');status.textContent='서버의 가린 검사 기록을 불러오고 있습니다.';
  try{const response=await fetch('/api/checks',{cache:'no-store'});if(!response.ok)throw Error('unavailable');const report=await response.json();
   renderReport(root,report,document);status.textContent=`서버 응답 확인: ${report.checkedAt} · 요청 ${report.requestId}`;
  }catch{root.querySelector('#operations-summary').replaceChildren();root.querySelector('#operations-rows').replaceChildren();status.textContent='검사 기록을 읽지 못했습니다. 재시도해 주세요. 미실행을 통과로 표시하지 않습니다.';}
  finally{button.disabled=false;root.setAttribute('aria-busy','false');}
 };
 button.addEventListener('click',refresh);void refresh();
}
