// Runtime adapter for the SIX existing deciders. No fixture events, credential bodies,
// note text, arbitrary browser alerts or shell commands enter this adapter.
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {isIP} from 'node:net';
import {decide as brute} from '../../xdr/brute-force/decide.mjs';
import {decide as web} from '../../xdr/web-injection/decide.mjs';
import {decide as cve} from '../../xdr/known-cve/decide.mjs';
import {decide as persistence} from '../../xdr/persistence/decide.mjs';
import {decide as privilege} from '../../xdr/privilege/decide.mjs';
import {decide as exfiltration} from '../../xdr/exfiltration/decide.mjs';
import {inputSignals,patternName} from '../../xdr/web-injection/signals.mjs';
import {addDenyRules,readDenyRules} from '../../xdr/brute-force/rule-store.mjs';
import {activeDenyRule} from '../../xdr/brute-force/guard.mjs';

const modules={'brute-force':brute,'web-injection':web,'known-cve':cve,persistence,privilege,exfiltration};
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function createGatewayXdr({directory,sourceAddress,audit,clock=Date.now}){
  if(!isIP(sourceAddress)||typeof audit!=='function')throw Error('XDR_TRUSTED_SOURCE_REQUIRED');
  for(const key of Object.keys(modules))await mkdir(join(directory,'xdr',key),{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(directory,'workspace.sqlite'));
  db.exec(`PRAGMA busy_timeout=1000;
    CREATE TABLE IF NOT EXISTS gateway_xdr_observations(id TEXT PRIMARY KEY,module TEXT NOT NULL,at INTEGER NOT NULL,action TEXT NOT NULL,confidence REAL NOT NULL,pattern TEXT NOT NULL,owner TEXT);
    CREATE TABLE IF NOT EXISTS gateway_xdr_counters(kind TEXT NOT NULL,source TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS gateway_xdr_seen(id TEXT PRIMARY KEY);
    CREATE TRIGGER IF NOT EXISTS gateway_xdr_no_delete BEFORE DELETE ON gateway_xdr_observations BEGIN SELECT RAISE(ABORT,'IMMUTABLE_XDR'); END;
    CREATE TRIGGER IF NOT EXISTS gateway_xdr_no_update BEFORE UPDATE ON gateway_xdr_observations BEGIN SELECT RAISE(ABORT,'IMMUTABLE_XDR'); END;`);
  const path=key=>join(directory,'xdr',key,'deny-rules.json'),at=()=>new Date(clock()).toISOString();
  let osCoverage={status:'not_checked',serviceEvents:'not_checked',securityEvents:'not_checked'};
  let writes=Promise.resolve();
  async function persist(key,rule){const operation=writes.then(()=>addDenyRules(path(key),[rule]));writes=operation.catch(()=>{});await operation;}
  async function rules(){return (await Promise.all(Object.keys(modules).map(k=>readDenyRules(path(k))))).flat();}
  async function check(){
    const rule=activeDenyRule(await rules(),sourceAddress,at(),null,null);
    return rule?{code:rule.ruleId.toUpperCase().replaceAll('.','_'),evidenceId:rule.evidenceAlertIds.at(-1),retryAfter:Math.max(1,Math.ceil((Date.parse(rule.expiresAt)-clock())/1000))}:null;
  }
  async function observe(key,alert,actor,{canBlock=true}={}){
    const d=await modules[key](alert),id=alert.id??randomUUID(),pattern=d.reason.split(':')[0];
    if(!['block','alert','record'].includes(d.action)||!Number.isFinite(d.confidence)||d.confidence<0||d.confidence>1||!/^[a-z0-9_]{1,100}$/.test(pattern))throw Error('XDR_RESULT_INVALID');
    db.prepare('INSERT INTO gateway_xdr_observations VALUES(?,?,?,?,?,?,?)').run(id,key,clock(),d.action,d.confidence,pattern,actor?.owner??null);
    // A Windows OS account is NOT a Supabase account. Missing target/account or
    // destination binding never turns into a broad application-account block.
    if(d.action==='block'&&canBlock&&d.confidence>=.85){
      await persist(key,{ruleId:'xdr.'+key.replaceAll('-','_'),action:'deny',sourceAddress,
        confidence:d.confidence,createdAt:at(),expiresAt:new Date(clock()+900000).toISOString(),evidenceAlertIds:[id]});
    }
    if(d.action!=='record'&&actor)audit(actor,{kind:'xdr',appId:'vault',summary:`기존 XDR ${key} 판단: ${d.action}${d.action==='block'&&!canBlock?' · 대상 결속 부족으로 자동 집행하지 않음':''}`,
      access:d.action==='block'&&canBlock?'denied':'unknown',rule:'xdr.'+key.replaceAll('-','_'),actions:['device:revoke','grant:remove'],
      source:'Windows NetBird 게이트웨이 · 기존 XDR 판단기',evidence:[{id:'pattern',text:pattern},{id:'confidence',text:String(d.confidence)},{id:'response',text:canBlock?'추가 거부만 적용 · 유효기간 15분':'실제 대상 결속 확인 전에는 추가 거부하지 않음'}]});
    return d;
  }
  const event=(description,level=3,data={})=>({id:randomUUID(),timestamp:at(),rule:{level,description},data:{srcip:sourceAddress,...data}});
  function count(kind){db.prepare('INSERT INTO gateway_xdr_counters VALUES(?,?,?)').run(kind,sourceAddress,clock());return db.prepare('SELECT count(*) n FROM gateway_xdr_counters WHERE kind=? AND source=? AND at>?').get(kind,sourceAddress,clock()-120000).n;}
  return {
    check,
    async inspect(input,actor){
      const url=new URL(input.path,'https://fixed.invalid');
      // Original HTTP policy inspects only query syntax, never Auth or note bodies.
      const query=[...url.searchParams].filter(([k])=>!/(?:token|password|secret|key|authorization|cookie|email)/i.test(k)).map(([,v])=>v).join(' ');
      await observe('known-cve',event('게이트웨이가 받은 HTTP 쿼리',3,{query}),actor);
      const p=patternName(inputSignals(query));
      if(p){const n=count('web'),names={sql_injection:'SQL 구문',script_injection:'스크립트 삽입 표식',path_traversal:'경로 이탈 표기',command_injection:'명령 구분자 표기'};
        await observe('web-injection',event(`같은 주소에서 ${names[p]}가 ${n}번 반복됐습니다.`,n>=8?12:6),actor);}
      return check();
    },
    async response(input,result,actor){
      const u=new URL(input.path,'https://fixed.invalid');
      if(u.pathname==='/api/auth'&&u.searchParams.get('path')==='token'&&u.searchParams.get('grant_type')==='password'){
        if(result.status===400&&['invalid_credentials'].includes(result.data?.error_code??result.data?.code)){
          const n=count('auth');await observe('brute-force',event(`120초 안에 같은 주소에서 로그인 실패 ${n}건이 쌓였습니다.`,n>=20?12:n<=1?3:6),actor);
        }else if(result.status<300)db.prepare("DELETE FROM gateway_xdr_counters WHERE kind='auth' AND source=?").run(sourceAddress);
      }
      if(u.pathname.includes('notes')&&input.method==='GET'&&result.status===200)
        await observe('exfiltration',event('승인된 고정 자료실에서 본인 자료를 정상 조회했습니다.',3,{bytes:Buffer.byteLength(JSON.stringify(result.data))}),actor,{canBlock:false});
    },
    async windows(observation,actor){
      osCoverage=observation.coverage;
      for(const row of observation.events){
        const id=hash(row.key);if(db.prepare('SELECT 1 FROM gateway_xdr_seen WHERE id=?').get(id))continue;
        await observe(row.kind,event(row.description,row.level),actor,{canBlock:false});
        db.prepare('INSERT INTO gateway_xdr_seen VALUES(?)').run(id);
      }
      return this.status(actor);
    },
    async status(actor){
      const current=await check();
      return {schema:'keshev.netbird.xdr.v1',checkedAt:at(),activeBlock:current,osCoverage,
        modules:Object.keys(modules).map(key=>{const r=db.prepare('SELECT count(*) count,max(at) last FROM gateway_xdr_observations WHERE module=? AND (owner=? OR owner IS NULL)').get(key,actor?.owner??'');return {id:key,connected:true,observations:r.count,lastObservedAt:r.last?new Date(r.last).toISOString():null};}),
        scope:'기존 자료실의 실제 HTTP와 읽을 수 있는 Windows 이벤트. PC 전체 파일·프로세스·임의 외부 전송은 수집하지 않음'};
    },close:()=>db.close(),
  };
}
