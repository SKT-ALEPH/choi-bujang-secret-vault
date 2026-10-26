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
async function request(path,input){const r=await fetch(path,input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message??'연결을 확인하지 못했습니다.');return d.data;}
async function refresh(){read.disabled=true;network.textContent='NetBird와 Windows 원천 확인 중…';out.textContent='현재 접근 상태 확인 중…';try{
  const n=await request('/api/netbird/network');network.textContent=`NetBird ${n.connection?.daemon==='Connected'?'연결됨':'확인 불가'} · Windows 원천 ${n.resource?.status==='reachable'?'응답 확인':'확인 불가'} · ${new Date(n.checkedAt??Date.now()).toLocaleString('ko-KR')}`;
  const m=await request('/api/netbird/status');out.textContent=`기존 자료실 계정 확인 · 게이트웨이 ${m.status.decision==='allow'?'접근 허용':'접근 차단'} · 세션 ${m.status.session.state} · 기기 보안 기준은 확인 불가`;
}catch(e){out.textContent=e.message;}finally{read.disabled=false;}}
read.addEventListener('click',refresh);
windowsButton.addEventListener('click',async()=>{
 windowsButton.disabled=true;windowsResult.replaceChildren(node('p','Windows 원천에서 읽는 중입니다.'));
 try{const d=await request('/api/netbird/windows');windowsResult.replaceChildren(node('h3','Windows 실제 관측'));
  for(const [key,label] of [['cpu','CPU'],['memory','메모리 사용'],['disk','디스크 가용']]){const m=d.pc?.metrics?.[key];windowsResult.append(node('p',`${label}: ${m?.status==='measured'?m.value.toFixed(2)+' '+m.unit:'확인 불가'}`));}
  const x=d.xdr;if(!x)throw Error('XDR 원천을 확인하지 못했습니다.');
  windowsResult.append(node('p',`기존 XDR 판단기 ${x.modules.filter(m=>m.connected).length}/6 연결 · 현재 추가 차단 ${x.activeBlock?'적용 중':'없음'}`));
  for(const m of x.modules)windowsResult.append(node('p',`${m.id}: 실제 관측 ${m.observations}건${m.lastObservedAt?' · '+new Date(m.lastObservedAt).toLocaleString('ko-KR'):' · 해당 근거 미관측'}`));
  windowsResult.append(node('p',`Windows 서비스 기록: ${x.osCoverage.serviceEvents} · 보안 기록: ${x.osCoverage.securityEvents}`),node('p',x.scope));
 }catch(e){windowsResult.replaceChildren(node('p',e.message));}finally{windowsButton.disabled=false;}
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
