const node=(tag,text)=>{const value=document.createElement(tag);if(text)value.textContent=text;return value;};
const view=document.getElementById('view-protection'),card=node('section');card.className='card';
card.append(node('h2','NetBird로 연결하는 기존 자료실'),node('p','원래 자료실의 계정과 자료를 사용합니다. 자료는 기존 Supabase에 있고, 요청은 Windows 게이트웨이를 거칩니다.'));
const link=node('a','기존 자료실 열기');link.href='/vault/';link.target='_blank';link.rel='noopener noreferrer';link.className='btn';
const read=node('button','연결 다시 확인');read.type='button';read.className='btn';
const out=node('p','기존 자료실에서 로그인하고 기기 승인을 완료한 뒤 연결을 확인하세요.');out.role='status';
const network=node('p','NetBird 연결 확인 전');network.role='status';
const restoreLabel=node('label'),confirmed=node('input');confirmed.type='checkbox';restoreLabel.append(confirmed,document.createTextNode(' 본인의 기존 자료실 접근 복구를 확인합니다.'));
const restore=node('button','기존 자료실 접근 복구');restore.type='button';restore.className='btn';
const row=node('div');row.className='row';row.append(link,read);card.append(row,network,out,restoreLabel,restore);
view?.querySelector('.page-heading')?.after(card);
async function request(path,input){const r=await fetch(path,input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error?.message??'연결을 확인하지 못했습니다.');return d.data;}
async function refresh(){read.disabled=true;try{
  const n=await request('/api/netbird/network');network.textContent=`NetBird ${n.connection?.daemon==='Connected'?'연결됨':'확인 불가'} · Windows 원천 ${n.resource?.status==='reachable'?'응답 확인':'확인 불가'} · ${new Date(n.checkedAt??Date.now()).toLocaleString('ko-KR')}`;
  const m=await request('/api/netbird/status');out.textContent=`기존 자료실 계정 확인 · 게이트웨이 ${m.status.decision==='allow'?'접근 허용':'접근 차단'} · 세션 ${m.status.session.state} · 기기 보안 기준은 확인 불가`;
}catch(e){out.textContent=e.message;}finally{read.disabled=false;}}
read.addEventListener('click',refresh);
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
