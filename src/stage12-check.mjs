// Read-only HTTP observations and one unauthenticated restore rejection.
// Normal protected-data requests use the separate server-only A/B protocol driver.
import {readFile} from 'node:fs/promises';
export async function runStage12Checks(config){
 const app=new URL(config.publicAppUrl);if(app.protocol!=='https:'||app.username||app.password||app.pathname!=='/'||app.search||app.hash)throw Error('INVALID_APP_URL');
 const out=[],uuid='00000000-0000-4000-8000-000000000001';
 async function probe(caseId,path,expected,accept,options={}){
  const r=await fetch(new URL(path,app),{...options,redirect:'error',signal:AbortSignal.timeout(10000),alephEvidence:{caseId,requestKey:'read'}});
  const text=await r.text();let json;try{json=JSON.parse(text);}catch{}
  const passed=accept(r,json,text);
  if(!passed)throw Error(`${caseId}: HTTP ${r.status} did not match expected result`);
  out.push({attackId:caseId,expected,observed:`HTTP ${r.status}${typeof json?.ready==='boolean'?'; jsonReady='+json.ready:''}`});
 }
 await probe('s01-static-notes','/data.json','공개 가상 메모0건',(r,j)=>r.ok&&Array.isArray(j?.notes)&&j.notes.length===0);
 await probe('s02-static-copy','/notes.json','이전 정적 사본 없음',r=>r.status===404);
 const denied=(r,j)=>[401,403,404].includes(r.status)&&typeof j?.error==='string'&&! /"(?:notes|content|body)"\s*:/u.test(JSON.stringify(j));
 await probe('s03-unauth-list','/api/my/notes','비로그인 목록401', (r,j)=>r.status===401&&denied(r,j));
 await probe('s03-fake-token','/api/my/notes','무효 토큰401',(r,j)=>r.status===401&&denied(r,j),{headers:{Authorization:'Bearer invalid.invalid.invalid'}});
 await probe('s04-header-identity','/api/my/notes','임의 신원 헤더로 로그인 대체 불가',denied,{headers:{'x-user-id':uuid,'x-role':'instructor'}});
 const settings=JSON.parse(await readFile(new URL('../config/supabase-public.json',import.meta.url),'utf8'));
 const direct=new URL(config.originalApiUrl);direct.searchParams.set('select','id');
 await probe('s05-direct-table',direct.href,'anon 직접 DB 조회거부',denied,{headers:{apikey:settings.publishableKey}});
 await probe('s08-other-zone','/api/announcements/'+uuid,'비로그인 공지 조회거부',denied);
 await probe('s10-restore-unauth',config.restoreRoute.replace(':noteId',uuid),'비로그인 복원거부',denied,{method:'POST'});
 await probe('s11-device','/api/device?operation=status','비로그인 기기 승인불가',denied);
 await probe('deployment_identity','/aleph.json','12단계와 저장소 배포 신원',(r,j)=>r.ok&&j?.step===12&&j.repoUrl?.toLowerCase()===config.repoUrl.toLowerCase());
 await probe('security_header','/','첫 화면 nosniff',(r)=>r.ok&&r.headers.get('x-content-type-options')==='nosniff');
 await probe('installable_app_manifest','/manifest.webmanifest','같은 자료실 설치주소',(r,j)=>r.ok&&j?.start_url==='/'&&j.display==='standalone');
 await probe('operations_actual_api','/api/checks','서버 가린 기록과 검증 정책 API',(r,j)=>r.ok&&j?.schema==='aleph.operations.v1'&&j.policy?.verified===true&&Array.isArray(j.rules)&&Array.isArray(j.verification?.records));
 for(const id of ['s06-normal','s06-unregistered','s07-compound','s08-unknown-route','s08-all-notes','s08-write-notice','s09-burst-read']){
  await probe(id,'/api/checks?case='+id,'고정 가상 입력 실제 HTTP 결과 대조',(r,j)=>r.ok&&j?.caseId===id&&j.kind==='synthetic_input_over_http'&&j.ready===true);
 }
 return out;
}
