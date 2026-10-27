const node=(tag,text)=>{const value=document.createElement(tag);if(text)value.textContent=text;return value;};
const view=document.getElementById('view-protection'),card=node('section');card.className='card';
card.append(node('h2','NetBird로 연결하는 기존 자료실'),node('p','원래 자료실의 계정과 자료를 사용합니다. 자료는 기존 Supabase에 있고, 요청은 Windows 게이트웨이를 거칩니다.'));
const link=node('a','기존 자료실 열기');link.href='/vault/';link.target='_blank';link.rel='noopener noreferrer';link.className='btn';
const read=node('button','연결 다시 확인');read.type='button';read.className='btn';
const out=node('p','기존 자료실에서 로그인하고 기기 승인을 완료한 뒤 연결을 확인하세요.');out.role='status';
const network=node('p','NetBird 연결 확인 전');network.role='status';
const windowsButton=node('button','Windows 상태와 XDR 확인');windowsButton.type='button';windowsButton.className='btn';
const windowsResult=node('div');windowsResult.role='status';
const restoreLabel=node('label'),confirmed=node('input');confirmed.type='checkbox';restoreLabel.append(confirmed,document.createTextNode(' 본인의 기존 자료실 접근 복구를 확인합니다.'));
const restore=node('button','기존 자료실 접근 복구');restore.type='button';restore.className='btn';
const row=node('div');row.className='row';row.append(link,read,windowsButton);card.append(row,network,out,restoreLabel,restore,windowsResult);
view?.querySelector('.page-heading')?.after(card);
const pc=node('section');pc.className='card student-netbird-panel';
const pcTitle=node('h2','두 PC의 감시와 송신 차단'),pcDescription=node('p','Wazuh가 시스템 기록·설치 프로그램·지정 경로의 파일 변경을 모읍니다. 미승인 목적지로 반복·대량 송신이 관측되면 해당 목적지와 포트에 15분 차단을 적용합니다.');
const pcRead=node('button','PC 감시 다시 확인');pcRead.type='button';pcRead.className='btn';
const pcStatus=node('p','감시 서버 확인 전');pcStatus.role='status';
const pcDevices=node('div');pcDevices.className='status-view';
const pcDetails=node('details'),pcSummary=node('summary','송신 경보와 실제 대응 기록'),pcEvents=node('div');pcDetails.append(pcSummary,pcEvents);
pc.append(pcTitle,pcDescription,pcRead,pcStatus,pcDevices,pcDetails,node('p','PC 관측은 자료실 계정의 행동으로 추정하지 않습니다. 패킷·파일 본문은 수집하지 않으며, 이 정보는 AI에 자동 전송하지 않습니다. Mac은 표본 관측·신규 연결 차단 방식입니다.'));card.after(pc);
let pcSnapshot,pcExpiry;
const when=at=>Number.isFinite(Date.parse(at))?new Date(at).toLocaleString('ko-KR'):'확인 불가';
function renderPc(){
 const d=pcSnapshot;pcDevices.replaceChildren();pcEvents.replaceChildren();if(!d)return;
 const expired=Date.now()-Date.parse(d.checkedAt)>45000;
 pcStatus.textContent=expired?'조회 후 시간이 지났습니다. 현재 상태를 다시 확인하세요.':`조회 시각 ${when(d.checkedAt)} · ${d.endpoints.filter(e=>e.telemetry==='measured').length}/2 기기에서 최근 송신 관측 확인`;
 for(const expected of ['keshev-mac','keshev-windows']){
  const e=d.endpoints.find(e=>e.name===expected),c=node('section');c.className='student-connection-metric';pcDevices.append(c);
  c.append(node('h3',expected==='keshev-mac'?'내 Mac':'Windows'));
  c.append(node('p',!expired&&e?.telemetry==='measured'?'Wazuh 연결 · 최근 송신 관측 확인':e?.connection==='Active'?'Wazuh 연결 · 현재 송신 관측 재확인 필요':'연결 확인 필요'));
  c.append(node('p',`마지막 송신 관측 ${when(e?.heartbeat?.observedAt)}`));
  c.append(node('p',`OpenAI 통신 예외: ${Number(e?.heartbeat?.trustedServicesReady)===4?'필수 서비스 4개 DNS 확인':'확인 필요'}`));
  const inv=e?.inventory;c.append(node('p',inv?`파일 감시 ${Number(inv.monitoredFiles).toLocaleString()}건 · 설치 프로그램 ${Number(inv.installedPackages).toLocaleString()}건`:'파일 감시·설치 정보 확인 불가'));
  c.append(node('p',expected==='keshev-mac'?'표본 관측: 짧은 연결은 놓칠 수 있습니다.':'Windows 커널의 TCP·UDP 송신 메타데이터'));
 }
 if(!d.events.length)pcEvents.append(node('p','최근 수집 범위에 송신 경보가 없습니다. 경보 없음만으로 안전을 판단하지 않습니다.'));
 for(const e of [...d.events].reverse()){
  const c=node('section');c.className='student-connection-metric';pcEvents.append(c);
  const label=d.endpoints.find(a=>a.id===e.agentId)?.name==='keshev-mac'?'Mac':'Windows';
  c.append(node('h3',`${label} · 반복·대량 송신 관측`),node('p',`${when(e.observedAt)} · ${(Number(e.bytes)/1000000).toFixed(1)} MB · ${e.connections}개 연결 · ${e.protocol} ${e.port} 포트`));
  c.append(node('p',`현재 OS 차단: ${expired||e.nativeState==='unknown'?'확인 불가':e.nativeState==='blocked'?'적용 중':'없음'} · 관측 ${when(e.nativeObservedAt)}`));
  const r=e.response;c.append(node('p',r?`실제 대응 이력: ${r.command==='add'?'차단 적용':'차단 해제'} ${r.effectApplied?'확인':'미확인'} · ${when(r.at)}${r.command==='add'?' · 자동 해제 예정 '+when(r.expiresAt):''}`:'현재 수집 범위에서 대응 영수증을 확인하지 못했습니다.'));
 }
 const system=node('details');system.append(node('summary','Wazuh 시스템 검사·변경 기록'));pcEvents.append(system);
 system.append(node('p','원문·계정·파일 경로를 제외한 최근 수집 기록입니다. 검사 결과나 변경 기록 자체를 침해 확정으로 해석하지 않습니다.'));
 for(const e of [...(d.systemEvents??[])].reverse()){
  const label=d.endpoints.find(a=>a.id===e.agentId)?.name==='keshev-mac'?'Mac':'Windows';
  system.append(node('p',`${label} · ${when(e.at)} · ${({'file-change':'파일 변경','configuration-check':'보안 설정 검사','system-event':'시스템 기록'})[e.category]??'시스템 기록'} · 규칙 ${e.rule} · 수준 ${e.level}`));
 }
}
async function refreshPc(){
 pcRead.disabled=true;pc.setAttribute('aria-busy','true');pcStatus.textContent='두 PC의 Wazuh·방화벽 관측을 확인하고 있습니다…';clearTimeout(pcExpiry);
 try{pcSnapshot=await request('/api/pc-security');renderPc();pcExpiry=setTimeout(renderPc,46000);}
 catch(e){pcSnapshot=null;pcDevices.replaceChildren();pcEvents.replaceChildren();pcStatus.textContent=e.message;}
 finally{pcRead.disabled=false;pc.removeAttribute('aria-busy');}
}
pcRead.addEventListener('click',refreshPc);
async function request(path,input){const options=input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{};if(path.startsWith('/api/package/'))options.signal=AbortSignal.timeout(45000);const r=await fetch(path,options),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message??'연결을 확인하지 못했습니다.');return d.data;}

const intel=node('section');intel.className='card';
intel.append(node('h2','공식 침해 정보'),node('p','NVD 검색 목록과 CISA KEV를 소스에 선언된 구성 요소 버전과 대조합니다. 조회만으로 현재 PC의 취약점이나 침해를 확정하지 않습니다.'));
const componentLabel=node('label','대조할 구성 요소 '),component=node('select');componentLabel.append(component);
for(const [id,label] of [['node','Node.js'],['jose','jose'],['supabase','Supabase SDK'],['esbuild','esbuild'],['wazuh','Wazuh']]){const option=node('option',label);option.value=id;component.append(option);}
const pageLabel=node('label','목록 페이지 (1–40) '),pageInput=node('input');pageInput.type='number';pageInput.min='1';pageInput.max='40';pageInput.value='1';pageLabel.append(pageInput);
const intelRead=node('button','공식 목록 조회');intelRead.type='button';intelRead.className='btn';
const intelStatus=node('p','조회 전 · 기존 자료실에서 로그인과 기기 승인을 완료한 뒤 조회하세요.');intelStatus.role='status';
const intelResults=node('div'),intelControls=node('div');intelControls.className='row';intelControls.append(componentLabel,pageLabel,intelRead);intel.append(intelControls,intelStatus,intelResults);pc.after(intel);
async function refreshIntel(){
 const page=Number(pageInput.value)-1;if(!Number.isInteger(page)||page<0||page>39){intelStatus.textContent='목록 페이지를 1부터 40 사이의 정수로 입력하세요.';return;}
 intelRead.disabled=true;component.disabled=true;pageInput.disabled=true;intel.setAttribute('aria-busy','true');intelResults.replaceChildren();intelStatus.textContent='공식 원천을 확인하고 있습니다. 첫 조회는 원천 응답과 캐시 저장 때문에 시간이 걸릴 수 있습니다…';
 try{
  const d=await request('/api/package/intel?'+new URLSearchParams({component:component.value,page:String(page)}));
  if(!d?.component||!d.sources?.nvd||!d.sources?.kev||!d.scope||!Array.isArray(d.findings))throw Error('공식 원천 응답 형식을 확인하지 못했습니다.');
  intelStatus.textContent=`${d.component.name} ${d.component.version} · ${d.scope.startIndex+1}번부터 ${d.scope.examined}건 / 검색 ${d.scope.total}건 · 현재 페이지 대조`;
  intelResults.append(node('p','버전 근거: '+d.component.versionSource),node('p',`NVD 받은 시각: ${when(d.sources.nvd.fetchedAt)} · ${d.sources.nvd.cached?'6시간 이내 저장 자료':'이번에 수신'}`),node('p',`CISA KEV 받은 시각: ${when(d.sources.kev.fetchedAt)} · 목록 버전 ${d.sources.kev.catalogVersion} · ${d.sources.kev.cached?'6시간 이내 저장 자료':'이번에 수신'}`));
  intelResults.append(node('p',d.warning));
  if(!d.findings.length)intelResults.append(node('p','현재 검색 페이지에 기록이 없습니다. 취약점이 없거나 안전하다는 뜻이 아닙니다.'));
  for(const finding of d.findings){
   if(!/^CVE-\d{4}-\d{4,10}$/.test(finding.id))continue;
   const row=node('details'),summary=node('summary',finding.id+' · '+(finding.inKev?'KEV 등재':'KEV 미등재'));row.append(summary);
   row.append(node('p',({version_range_match:'선언 버전이 NVD의 해당 범위와 일치합니다. 환경·전제 조건을 추가 검토하세요.',outside_listed_ranges:'선언 버전이 이 기록의 명시 범위 밖입니다. 다른 기록까지 안전하다는 뜻은 아닙니다.',needs_review:'버전 또는 환경 조건을 자동 대조할 수 없습니다. 공식 원문을 검토하세요.'})[finding.versionComparison]??'대조 결과 확인 불가'),node('p',finding.description),node('p','NVD 기록 수정 시각: '+finding.lastModified));
   const reference=node('a','NVD 원문 열기');reference.href='https://nvd.nist.gov/vuln/detail/'+finding.id;reference.target='_blank';reference.rel='noopener noreferrer';row.append(reference);intelResults.append(row);
  }
  if(d.scope.hasNext)intelResults.append(node('p','다음 페이지가 있습니다. 위 페이지 숫자를 바꾸고 다시 조회하세요. 최신순 정렬이나 전체 검사를 보장하지 않습니다.'));
 }catch(error){intelResults.replaceChildren();intelStatus.textContent=`${error.name==='TimeoutError'?'공식 원천 조회 시간이 지났습니다.':error.message} 기존 자료실 로그인·NetBird·서버 설정을 확인한 뒤 직접 다시 조회하세요. 이전 성공을 최신 값으로 표시하지 않습니다.`;}
 finally{intelRead.disabled=false;component.disabled=false;pageInput.disabled=false;intel.removeAttribute('aria-busy');}
}
intelRead.addEventListener('click',refreshIntel);
const proxyDetails=node('details');proxyDetails.append(node('summary','서버 AI 중계와 호출 상한 점검'));
proxyDetails.append(node('p','기존 서버의 Jev에 학습용 숫자 요약(로그인 실패 0건)을 보냅니다. 실제 사건·자료 본문은 보내지 않습니다. 개인 OpenAI OAuth 설명과 별도이며, 서버 정책의 사용자별 일일 한도에 호출 시도 1회가 반영됩니다. 실제 상한은 응답에서 확인합니다.'));
const proxyRead=node('button','서버 AI 실제 응답 점검');proxyRead.type='button';proxyRead.className='btn';
const proxyStatus=node('p','점검 전');proxyStatus.role='status';proxyDetails.append(proxyRead,proxyStatus);intel.append(proxyDetails);
proxyRead.addEventListener('click',async()=>{
 proxyRead.disabled=true;proxyDetails.setAttribute('aria-busy','true');proxyStatus.textContent='서버가 로그인·호출 상한을 확인한 뒤 AI에 요청합니다…';
 try{const d=await request('/api/package/ai',{level:0,failureCount:0,accountCount:0,multiAccount:false,samePassword:false});if(d.inferenceCompleted!==true||d.actionExecuted!==false||!d.quota)throw Error('완료된 서버 AI 응답을 확인하지 못했습니다.');proxyStatus.textContent=`${d.summary} · 오늘 서버 호출 ${d.quota.used}/${d.quota.limit} · 한도 초기화 ${when(d.quota.resetsAt)} · 응답 ${when(d.checkedAt)}`;}
 catch(error){proxyStatus.textContent=`${error.message} 실제 응답 성공으로 표시하지 않습니다. 설정과 한도를 확인한 뒤 직접 다시 요청하세요.`;}
 finally{proxyRead.disabled=false;proxyDetails.removeAttribute('aria-busy');}
});
async function refresh(){read.disabled=true;network.textContent='NetBird와 Windows 원천 확인 중…';out.textContent='현재 접근 상태 확인 중…';try{
  const n=await request('/api/netbird/network');network.textContent=`NetBird ${n.connection?.daemon==='Connected'?'연결됨':'확인 불가'} · Windows 원천 ${n.resource?.status==='reachable'?'응답 확인':'확인 불가'} · ${new Date(n.checkedAt??Date.now()).toLocaleString('ko-KR')}`;
  const m=await request('/api/netbird/status');out.textContent=`기존 자료실 계정 확인 · 게이트웨이 ${m.status.decision==='allow'?'접근 허용':'접근 차단'} · 세션 ${m.status.session.state} · 기기 보안 기준은 확인 불가`;
}catch(e){out.textContent=e.message;}finally{read.disabled=false;}}
read.addEventListener('click',refresh);
const windowsMeasurements={};
windowsButton.addEventListener('click',async()=>{
 windowsButton.disabled=true;windowsResult.setAttribute('aria-busy','true');windowsResult.replaceChildren(node('p','Windows 원천에서 읽는 중입니다.'));
 try{const d=await request('/api/netbird/windows');windowsResult.replaceChildren(node('h3','Windows 실제 관측'));
  for(const [key,label,unit] of [['cpu','CPU','%'],['memory','메모리 사용','GiB'],['disk','디스크 가용','GiB']]){
   const m=d.pc?.metrics?.[key],metric=node('section');metric.className='student-connection-metric';windowsResult.append(metric);metric.append(node('h4',label));
   const valid=m?.status==='measured'&&m.unit===unit&&Number.isFinite(m.value)&&m.value>=0&&(key!=='cpu'||m.value<=100)&&Number.isFinite(Date.parse(m.observedAt))&&typeof m.source==='string'&&m.source.trim();
   if(valid){
    metric.append(node('p',`${m.value.toFixed(2)} ${unit}`));
    const previous=windowsMeasurements[key];
    metric.append(node('p',previous?.source===m.source?`이전 실측(${when(previous.at)}) 대비 ${m.value>=previous.value?'+':''}${(m.value-previous.value).toFixed(2)} ${key==='cpu'?'%p':unit}`:'같은 출처의 이전 실측이 없어 변화 비교는 아직 없습니다.'));
    windowsMeasurements[key]={value:m.value,at:m.observedAt,source:m.source};
   }else metric.append(node('p','확인 불가 · 유효한 실측을 읽지 못했습니다. 권한을 높이지 않고 다시 조회하세요.'));
   metric.append(node('p',`측정 시각: ${when(m?.observedAt)}`),node('p',`출처: ${typeof m?.source==='string'&&m.source.trim()?m.source:'확인 불가'}`));
  }
  windowsResult.append(node('p','CPU는 전체 논리 CPU의 구간 평균이며 메모리는 OS 전체−여유 집계입니다. 작업 관리자와 비교할 때 같은 시각·단위·집계 범위를 확인하세요.'));
  const x=d.xdr;if(!Array.isArray(x?.modules)||!x.osCoverage){windowsResult.append(node('p','XDR 원천 확인 불가 · 위 PC 실측과 별도입니다. Windows 연결을 확인한 뒤 다시 조회하세요.'));return;}
  windowsResult.append(node('p',`기존 XDR 판단기 ${x.modules.filter(m=>m.connected).length}/6 연결 · 현재 추가 차단 ${x.activeBlock?'적용 중':'없음'}`));
  for(const m of x.modules)windowsResult.append(node('p',`${m.id}: 실제 관측 ${m.observations}건${m.lastObservedAt?' · '+new Date(m.lastObservedAt).toLocaleString('ko-KR'):' · 해당 근거 미관측'}`));
  windowsResult.append(node('p',`Windows 서비스 기록: ${x.osCoverage.serviceEvents} · 보안 기록: ${x.osCoverage.securityEvents}`),node('p',x.scope));
 }catch(e){windowsResult.replaceChildren(node('p',`${e.message} NetBird·Windows 실행 상태를 확인한 뒤 다시 조회하세요.`));}finally{windowsButton.disabled=false;windowsResult.removeAttribute('aria-busy');}
});
restore.addEventListener('click',async()=>{if(!confirmed.checked){out.textContent='복구할 범위를 읽고 확인란을 선택하세요.';return;}restore.disabled=true;try{await request('/api/netbird/restore',{humanConfirmed:true});confirmed.checked=false;await refresh();out.textContent+=' · 복구했습니다. 자료실에서 다시 요청하세요.';document.getElementById('refresh')?.click();}catch(e){out.textContent=e.message;}finally{restore.disabled=false;}});
document.getElementById('personal-model')?.addEventListener('change',async e=>{
  if(!e.target.value)return;try{await request('/personal-ai/selected-model',{model:e.target.value});}catch(error){out.textContent=error.message;}
});
// These controls belong to the replaced class-only host, not the personal OAuth provider.
document.querySelector('[data-testid="ai-connect-card"]')?.setAttribute('hidden','');
document.getElementById('ai-check')?.closest('.card')?.setAttribute('hidden','');
document.getElementById('student-ai-connection')?.closest('.card')?.setAttribute('hidden','');
document.querySelector('.personal-security-label')?.replaceChildren(document.createTextNode('기존 자료실 · NetBird'));
document.getElementById('view-personal')?.setAttribute('hidden','');
refresh();
refreshPc();
