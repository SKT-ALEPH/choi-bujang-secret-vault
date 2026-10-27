import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {fault} from './common.mjs';

export function openStore(path){
  const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS nonces(id TEXT PRIMARY KEY,at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS restrictions(id TEXT PRIMARY KEY,subject TEXT NOT NULL,session TEXT NOT NULL,device TEXT NOT NULL,resource TEXT NOT NULL,control TEXT NOT NULL,until INTEGER NOT NULL,evidence TEXT NOT NULL,created INTEGER NOT NULL,released INTEGER);
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,source TEXT NOT NULL,request_id TEXT,subject TEXT,session TEXT,device TEXT,resource TEXT,at INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,subject TEXT NOT NULL,at INTEGER NOT NULL,bytes INTEGER NOT NULL,active INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,at INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS server_registry(id TEXT PRIMARY KEY,agent TEXT UNIQUE NOT NULL,enabled INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,at INTEGER NOT NULL,data TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);`);
  db.exec('CREATE TABLE IF NOT EXISTS auth_failures(peer TEXT NOT NULL,at INTEGER NOT NULL)');
  db.exec('CREATE TABLE IF NOT EXISTS acknowledged_observations(id TEXT PRIMARY KEY,at INTEGER NOT NULL)');
  const consume=nonce=>{try{db.prepare('INSERT INTO nonces VALUES(?,?)').run(nonce,Date.now());}catch{throw fault('REPLAY_REJECTED',403);}};
  const event=(source,data)=>{
    const id=data.eventId??randomUUID();
    db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?)').run(id,source,data.requestId??null,data.subjectId??null,data.sessionId??null,data.deviceCredentialId??null,data.resource??null,Date.now(),JSON.stringify({...data,eventId:id}));return id;
  };
  function active(context,now=Date.now()){
    return db.prepare(`SELECT * FROM restrictions WHERE subject=? AND (session='*' OR session=?) AND (device='*' OR device=?) AND (resource='*' OR resource=?) AND until>? AND released IS NULL ORDER BY created`).all(context.subjectId,context.sessionId,context.deviceCredentialId,context.resource,now);
  }
  function restrict(context,{control='deny',until,evidenceId},now=Date.now()){
    if(!['deny','require_mfa','limit_response'].includes(control)||!Number.isSafeInteger(until)||until<=now)throw fault('INVALID_RESTRICTION',400);
    const id=randomUUID();db.prepare('INSERT INTO restrictions VALUES(?,?,?,?,?,?,?,?,?,NULL)').run(id,context.subjectId,context.sessionId,context.deviceCredentialId,context.resource,control,until,evidenceId,now);
    event('server-a',{...context,kind:'restriction-applied',actionId:id,control,until,evidenceIds:[evidenceId]});return id;
  }
  function reserve(context,policy,now=Date.now()){
    // One synchronous SQLite transaction reserves the full possible response before transmission.
    db.exec('BEGIN IMMEDIATE');
    try{
      const r=db.prepare('SELECT count(*) requests,coalesce(sum(bytes),0) bytes,coalesce(sum(active),0) concurrent FROM reservations WHERE subject=? AND at>?').get(context.subjectId,now-policy.windowMs);
      if(r.requests>=policy.maxRequests||r.bytes+policy.maxResponseBytes>policy.maxWindowBytes||r.concurrent>=policy.maxConcurrent)throw fault('ACCESS_BUDGET_EXCEEDED',429);
      const id=randomUUID();db.prepare('INSERT INTO reservations VALUES(?,?,?,?,1)').run(id,context.subjectId,now,policy.maxResponseBytes);db.exec('COMMIT');return id;
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function finish(id,bytes){db.prepare('UPDATE reservations SET active=0,bytes=? WHERE id=?').run(bytes,id);}
  function queue(data){
    if(db.prepare('SELECT count(*) n FROM outbox').get().n>=10000)throw fault('AUDIT_CAPACITY_EXCEEDED');
    const id=randomUUID();db.prepare('INSERT INTO outbox VALUES(?,?,?)').run(id,Date.now(),JSON.stringify(data));return id;
  }
  return {db,consume,event,active,restrict,reserve,finish,queue,close:()=>db.close()};
}
