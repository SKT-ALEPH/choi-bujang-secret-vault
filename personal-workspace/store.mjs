import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {sha,fault,uuid,opaque,exact} from './wire.mjs';
const now=()=>new Date().toISOString();
const ACTIONS=['device:revoke','grant:remove'];
const safeText=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export function createWorkspaceStore(path,{deviceId}){
 if(!opaque(deviceId))throw fault('DEVICE_INVALID');
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;
 CREATE TABLE IF NOT EXISTS devices(owner TEXT NOT NULL,id TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,granted INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,PRIMARY KEY(owner,id));
 CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,owner TEXT NOT NULL,device TEXT NOT NULL,state TEXT NOT NULL,expires INTEGER NOT NULL,created TEXT NOT NULL,stepup_until INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,revision INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,owner TEXT NOT NULL,device TEXT NOT NULL,kind TEXT NOT NULL,at TEXT NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS actions(id TEXT PRIMARY KEY,owner TEXT NOT NULL,session TEXT NOT NULL,event TEXT NOT NULL,action TEXT NOT NULL,generation INTEGER NOT NULL,digest TEXT NOT NULL,confirmation TEXT NOT NULL,expires INTEGER NOT NULL,status TEXT NOT NULL,effect INTEGER NOT NULL DEFAULT 0,observed TEXT);
 CREATE TABLE IF NOT EXISTS nonces(id TEXT PRIMARY KEY,at INTEGER NOT NULL);
 CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVENT'); END;
 CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'IMMUTABLE_EVENT'); END;`);
 const statement=sql=>db.prepare(sql);
 const device=owner=>statement('SELECT * FROM devices WHERE owner=? AND id=?').get(owner,deviceId);
 function actor(raw){if(!exact(raw,['owner','device','session'])||!opaque(raw.owner)||raw.device!==deviceId||!uuid(raw.session))throw fault('ACTOR_INVALID',403);return raw;}
 function event(a,{kind='access',appId='private-workspace',summary,access='unknown',rule='OWN_WORKSPACE_ACCESS',actions=[],evidence=[]}){
  const id=randomUUID(),at=now(),d=device(a.owner),s=statement('SELECT state FROM sessions WHERE id=? AND owner=? AND device=?').get(a.session,a.owner,deviceId);
  const value={id,kind,at,appId,summary,evidence:[{id:'source',text:'Windows 개인 업무 서버의 실제 요청·정책 관측'},{id:'rule',text:rule},...evidence],rules:[{id:rule,text:rule}],state:{access,session:s?.state??'unknown',device:d?.revoked?'revoked':'registered'},supportedActions:actions,target:{id:deviceId,generation:d?.revision??1},source:'windows-personal-workspace'};
  statement('INSERT INTO events VALUES(?,?,?,?,?,?)').run(id,a.owner,deviceId,kind,at,JSON.stringify(value));return value;
 }
 function allowed(a,{audit=true,appId='private-workspace'}={}){
  const d=device(a.owner),s=statement('SELECT * FROM sessions WHERE id=? AND owner=? AND device=?').get(a.session,a.owner,deviceId);
  const reason=!d?'DEVICE_UNREGISTERED':d.revoked?'DEVICE_REVOKED':!s||s.state!=='active'||s.expires<=Date.now()?'SESSION_EXPIRED':!d.granted?'GRANT_REMOVED':null;
  if(reason&&audit){
   event(a,{appId,summary:'업무 공간 요청이 거부됐습니다.',access:'denied',rule:reason});
   const count=statement("SELECT count(*) n FROM events WHERE owner=? AND device=? AND kind='access' AND at>? AND json_extract(data,'$.state.access')='denied'").get(a.owner,deviceId,new Date(Date.now()-60000).toISOString()).n;
   const recent=statement("SELECT count(*) n FROM events WHERE owner=? AND kind='xdr' AND at>?").get(a.owner,new Date(Date.now()-60000).toISOString()).n;
   if(count>=5&&!recent)event(a,{kind:'xdr',summary:'같은 기기의 반복된 권한 거부 요청을 관측했습니다.',access:'denied',rule:'REPEATED_AUTHORIZATION_DENIALS',actions:ACTIONS,evidence:[{id:'count',text:`60초 이내 권한 거부 ${count}건. 비밀번호 추측이나 PC 전체 침해로 단정하지 않습니다.`}]});
  }
  return reason;
 }
 function requireAccess(a){const reason=allowed(a);if(reason)throw fault(reason,403);}
 const rows=owner=>statement('SELECT data FROM events WHERE owner=? ORDER BY at DESC,rowid DESC LIMIT 200').all(owner).map(r=>JSON.parse(r.data));
 function session(a){actor(a);const t=now();statement('INSERT OR IGNORE INTO devices(owner,id,created) VALUES(?,?,?)').run(a.owner,deviceId,t);const d=device(a.owner);if(!d.revoked){const previous=statement('SELECT * FROM sessions WHERE id=?').get(a.session);if(previous&&(previous.owner!==a.owner||previous.device!==deviceId))throw fault('SESSION_SCOPE_CHANGED',403);if(!previous){statement('INSERT INTO sessions(id,owner,device,state,expires,created) VALUES(?,?,?,?,?,?)').run(a.session,a.owner,deviceId,'active',Date.now()+8*3600000,t);event(a,{summary:'검증된 계정으로 이 기기의 업무 세션을 열었습니다.',rule:'VERIFIED_AGENT_SESSION'});}}return status(a);}
 function status(a){actor(a);const d=device(a.owner),s=statement('SELECT * FROM sessions WHERE owner=? AND device=? AND id=?').get(a.owner,deviceId,a.session);const reason=allowed(a,{audit:false});return {owner:a.owner,device:{id:deviceId,registered:!!d,revoked:!!d?.revoked,revision:d?.revision??0,compliance:'unknown'},session:{id:a.session,state:s?.expires<=Date.now()?'expired':s?.state??'unavailable',expiresAt:s?new Date(s.expires).toISOString():null},grant:!!d?.granted,decision:reason?'deny':'allow',reason:reason??'REGISTERED_SESSION_AND_GRANT',checkedAt:now()};}
 const snapshot=(a,e)=>sha(JSON.stringify({event:e,generation:device(a.owner)?.revision}));
 function actionRow(a,id){const r=statement('SELECT * FROM actions WHERE id=? AND owner=?').get(id,a.owner);if(!r)throw fault('ACTION_NOT_FOUND',404);return r;}
 function receipt(a,id,replayed=false){const r=actionRow(a,id),d=device(a.owner),applied=r.action==='device:revoke'?!!d?.revoked:!d?.granted;return {requestId:r.id,eventId:r.event,actionId:r.action,target:deviceId,status:r.status==='prepared'&&r.expires<Date.now()?'expired':r.status==='succeeded'&&(!applied||d.revision!==r.generation+1)?'superseded':r.status,replayed,effectApplied:r.effect===1,observedAt:r.observed,currentlyApplied:applied};}
 function prepare(a,input){
  if(!exact(input,['eventId','actionId'])||!uuid(input.eventId)||!ACTIONS.includes(input.actionId))throw fault('ACTION_INVALID',400);
  const e=rows(a.owner).find(e=>e.id===input.eventId),d=device(a.owner);if(!e||e.target.id!==deviceId||!e.supportedActions.includes(input.actionId)||!d)throw fault('ACTION_NOT_SUPPORTED',403);
  if(e.target.generation!==d.revision)throw fault('CONFIRMATION_EXPIRED_OR_CHANGED');
  const id=randomUUID(),confirmation=randomBytes(32).toString('base64url'),expires=Date.now()+60000;
  statement('INSERT INTO actions(id,owner,session,event,action,generation,digest,confirmation,expires,status) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,a.owner,a.session,e.id,input.actionId,d.revision,snapshot(a,e),sha(confirmation),expires,'prepared');
  return {requestId:id,eventId:e.id,actionId:input.actionId,target:deviceId,status:'prepared',confirmationId:confirmation,expiresAt:new Date(expires).toISOString(),scope:'이 개인 업무 공간의 접근 권한만 변경합니다. NetBird·OS·기존 자료실 권한은 변경하지 않습니다.'};
 }
 function execute(a,input){
  if(!exact(input,['requestId','confirmationId','humanConfirmed'])||!uuid(input.requestId)||typeof input.confirmationId!=='string'||input.confirmationId.length!==43||input.humanConfirmed!==true)throw fault('CONFIRMATION_REQUIRED',400);
  db.exec('BEGIN IMMEDIATE');
  try{
   const r=actionRow(a,input.requestId),e=rows(a.owner).find(e=>e.id===r.event),d=device(a.owner);
   if(r.status!=='prepared'){db.exec('COMMIT');return receipt(a,r.id,true);}
   if(r.session!==a.session||r.expires<Date.now()||!timingSafeEqual(Buffer.from(r.confirmation),Buffer.from(sha(input.confirmationId)))||!e||r.digest!==snapshot(a,e)||r.generation!==d?.revision)throw fault('CONFIRMATION_EXPIRED_OR_CHANGED');
   if(r.action==='device:revoke'){statement('UPDATE devices SET revoked=1,revision=revision+1 WHERE owner=? AND id=?').run(a.owner,deviceId);statement("UPDATE sessions SET state='revoked' WHERE owner=? AND device=?").run(a.owner,deviceId);}
   else statement('UPDATE devices SET granted=0,revision=revision+1 WHERE owner=? AND id=?').run(a.owner,deviceId);
   const at=now();statement("UPDATE actions SET status='succeeded',effect=1,observed=? WHERE id=?").run(at,r.id);
   event(a,{summary:r.action==='device:revoke'?'이 기기의 개인 업무 공간 접근을 철회했습니다.':'이 기기의 개인 업무 공간 이용 권한을 회수했습니다.',access:'denied',rule:'HUMAN_CONFIRMED_'+r.action.replace(':','_').toUpperCase()});
   db.exec('COMMIT');return receipt(a,r.id);
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function route(path,raw){
  if(!exact(raw,['actor','input']))throw fault('INVALID_ENVELOPE',400);const a=actor(raw.actor),input=raw.input;
  if(path==='/agent/session')return session(a);
  if(!device(a.owner))throw fault('OWNER_NOT_REGISTERED',403);
  if(path==='/agent/status')return status(a);
  if(path==='/agent/pc'){requireAccess(a);if(!exact(input,[]))throw fault('INPUT_INVALID',400);return {authorized:true};}
  if(path==='/agent/logout'){if(!exact(input,[]))throw fault('INPUT_INVALID',400);statement("UPDATE sessions SET state='revoked' WHERE id=? AND owner=? AND device=?").run(a.session,a.owner,deviceId);event(a,{summary:'본인 요청으로 업무 세션을 종료했습니다.',rule:'OWNER_SIGN_OUT'});return {signedOut:true};}
  if(path==='/agent/receipts')return {receipts:statement('SELECT id FROM actions WHERE owner=? ORDER BY rowid DESC LIMIT 50').all(a.owner).map(r=>receipt(a,r.id))};
  if(path==='/agent/events')return {events:rows(a.owner),total:statement('SELECT count(*) n FROM events WHERE owner=?').get(a.owner).n};
  if(path==='/agent/action/prepare')return prepare(a,input);
  if(path==='/agent/action/execute')return execute(a,input);
  if(path==='/agent/action/result'){if(!exact(input,['requestId'])||!uuid(input.requestId))throw fault('ACTION_INVALID',400);return receipt(a,input.requestId);}
  if(path==='/agent/restore'){
   if(!exact(input,['humanConfirmed'])||input.humanConfirmed!==true)throw fault('CONFIRMATION_REQUIRED',400);
   statement('UPDATE devices SET revoked=0,granted=1,revision=revision+1 WHERE owner=? AND id=?').run(a.owner,deviceId);
   statement("UPDATE sessions SET state='active',expires=? WHERE owner=? AND device=? AND id=?").run(Date.now()+8*3600000,a.owner,deviceId,a.session);
   event(a,{summary:'본인 확인 후 개인 업무 공간 접근 권한을 복구했습니다.',access:'allowed',rule:'OWNER_CONFIRMED_RESTORE'});return session(a);
  }
  if(path==='/agent/stepup'){requireAccess(a);if(!exact(input,['humanConfirmed'])||input.humanConfirmed!==true)throw fault('CONFIRMATION_REQUIRED',400);statement('UPDATE sessions SET stepup_until=? WHERE id=? AND owner=? AND device=?').run(Date.now()+300000,a.session,a.owner,deviceId);event(a,{appId:'private-archive',summary:'보관함 열기 확인을 완료했습니다. 5분 동안 유효하며 별도 다중요소 인증은 아닙니다.',access:'allowed',rule:'ARCHIVE_OPEN_CONFIRMATION'});return {confirmedUntil:new Date(Date.now()+300000).toISOString()};}
  if(path==='/agent/access'){
   if(!exact(input,['appId'])||!['private-workspace','private-archive'].includes(input.appId))throw fault('INPUT_INVALID',400);
   const reason=allowed(a,{appId:input.appId});const stepup=statement('SELECT stepup_until FROM sessions WHERE id=? AND owner=?').get(a.session,a.owner)?.stepup_until;
   const challenge=!reason&&input.appId==='private-archive'&&!(stepup>Date.now()),decision=reason?'deny':challenge?'challenge':'allow';
   if(!reason)event(a,{appId:input.appId,summary:challenge?'보관함 열기 확인이 필요합니다.':'Windows 사설 업무 공간 접근이 허용됐습니다.',access:challenge?'unknown':'allowed',rule:challenge?'ARCHIVE_OPEN_CONFIRMATION_REQUIRED':'OWN_WORKSPACE_ACCESS',actions:ACTIONS});
   return {appId:input.appId,decision,reason:reason??(challenge?'ARCHIVE_OPEN_CONFIRMATION_REQUIRED':'REGISTERED_SESSION_AND_GRANT'),checkedAt:now()};
  }
  if(path==='/agent/notes'){
   requireAccess(a);if(!exact(input,['view'])||!['active','archive'].includes(input.view))throw fault('INPUT_INVALID',400);
   if(input.view==='archive'&&!(statement('SELECT stepup_until FROM sessions WHERE id=? AND owner=?').get(a.session,a.owner)?.stepup_until>Date.now()))throw fault('ARCHIVE_CONFIRMATION_REQUIRED',403);
   return {notes:statement('SELECT id,title,body,revision,deleted,updated FROM notes WHERE owner=? AND deleted=? ORDER BY updated DESC,id LIMIT 200').all(a.owner,input.view==='archive'?1:0)};
  }
  if(path==='/agent/note/save'){
   requireAccess(a);if(!exact(input,['id','title','body','revision'])||input.id!==null&&!uuid(input.id)||!safeText(input.title,120)||typeof input.body!=='string'||input.body.length>12000||!Number.isSafeInteger(input.revision)||input.revision<0)throw fault('NOTE_INVALID',400);
   const id=input.id??randomUUID(),prev=statement('SELECT * FROM notes WHERE id=? AND owner=?').get(id,a.owner);
   if(input.id&&(!prev||prev.deleted))throw fault('NOTE_NOT_FOUND',404);if(prev&&prev.revision!==input.revision)throw fault('NOTE_CHANGED',409);
   if(prev)statement('UPDATE notes SET title=?,body=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').run(input.title.trim(),input.body,now(),id,a.owner,input.revision);
   else statement('INSERT INTO notes VALUES(?,?,?,?,?,?,?)').run(id,a.owner,input.title.trim(),input.body,1,0,now());
   event(a,{summary:prev?'개인 자료를 수정했습니다.':'개인 자료를 추가했습니다.',access:'allowed',rule:'OWN_NOTE_WRITE'});return {id};
  }
  if(path==='/agent/note/archive'){
   requireAccess(a);if(!exact(input,['id','revision','deleted'])||!uuid(input.id)||!Number.isSafeInteger(input.revision)||![0,1].includes(input.deleted))throw fault('NOTE_INVALID',400);
   if(input.deleted===0&&!(statement('SELECT stepup_until FROM sessions WHERE id=? AND owner=?').get(a.session,a.owner)?.stepup_until>Date.now()))throw fault('ARCHIVE_CONFIRMATION_REQUIRED',403);
   const r=statement('UPDATE notes SET deleted=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').run(input.deleted,now(),input.id,a.owner,input.revision);if(r.changes!==1)throw fault('NOTE_CHANGED',409);
   event(a,{appId:'private-archive',summary:input.deleted?'개인 자료를 보관함으로 옮겼습니다.':'개인 자료를 복구했습니다.',access:'allowed',rule:'OWN_NOTE_ARCHIVE'});return {updated:true};
  }
  throw fault('NOT_FOUND',404);
 }
 return {route,acceptNonce(nonce){try{statement('INSERT INTO nonces VALUES(?,?)').run(nonce,Date.now());}catch{throw fault('REPLAY_REJECTED',403);}},close:()=>db.close()};
}
