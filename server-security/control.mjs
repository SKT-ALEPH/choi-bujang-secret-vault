// Run only through the operator's Docker console; never exposed on the employee HTTP service.
import {openStore} from './store.mjs';
import {fault,uuid,sha} from './common.mjs';
import {randomUUID} from 'node:crypto';

const [action,id,confirmation]=process.argv.slice(2),store=openStore('/state/server-a.sqlite');
try{
  if(action==='list'){
    console.log(JSON.stringify(store.db.prepare('SELECT id,resource,control,until,released FROM restrictions ORDER BY created DESC LIMIT 100').all()));
  }else if(action==='recover'&&uuid(id)&&confirmation==='--confirm-local-operator'){
    const row=store.db.prepare('SELECT * FROM restrictions WHERE id=? AND released IS NULL').get(id);if(!row)throw fault('RESTRICTION_NOT_FOUND',404);
    const eventId=randomUUID();
    store.db.exec('BEGIN IMMEDIATE');
    try{
      store.event('local-operator',{eventId,kind:'recovery-approved',actionId:id,resource:row.resource,subjectId:row.subject,sessionId:row.session,deviceCredentialId:row.device,reasonCode:'LOCAL_OPERATOR_REVIEW'});
      store.queue({eventId,requestId:id,subjectId:row.subject,sessionId:row.session,deviceCredentialId:row.device==='*'?null:row.device,resource:row.resource,
        kind:'recovery-approved',status:202,bytes:0,reasonCode:'LOCAL_OPERATOR_REVIEW',contextDigest:sha(JSON.stringify(['recovery-approval',id,row.subject,row.session,row.device,row.resource])),webEvent:null});
      store.db.prepare('UPDATE restrictions SET released=? WHERE id=?').run(Date.now(),id);store.db.exec('COMMIT');
    }catch(e){store.db.exec('ROLLBACK');throw e;}
    console.log(JSON.stringify({approved:true,restrictionId:id,auditId:eventId,restored:false,requiresActualRequestVerification:true}));
  }else throw fault('LOCAL_OPERATOR_CONFIRMATION_REQUIRED',403);
}finally{store.close();}
