// Run only through the operator's Docker console; never exposed on the employee HTTP service.
import {openStore} from './store.mjs';
import {fault,uuid} from './common.mjs';
import {randomUUID} from 'node:crypto';

const [action,id,confirmation]=process.argv.slice(2),store=openStore('/state/server-a.sqlite');
try{
  if(action==='list'){
    console.log(JSON.stringify(store.db.prepare('SELECT id,resource,control,until,released FROM restrictions ORDER BY created DESC LIMIT 100').all()));
  }else if(action==='recover'&&uuid(id)&&confirmation==='--confirm-local-operator'){
    const row=store.db.prepare('SELECT * FROM restrictions WHERE id=? AND released IS NULL').get(id);if(!row)throw fault('RESTRICTION_NOT_FOUND',404);
    const eventId=store.event('local-operator',{eventId:randomUUID(),kind:'recovery-approved',actionId:id,resource:row.resource,subjectId:row.subject,sessionId:row.session,deviceCredentialId:row.device,reasonCode:'LOCAL_OPERATOR_REVIEW'});
    store.db.prepare('UPDATE restrictions SET released=? WHERE id=?').run(Date.now(),id);
    console.log(JSON.stringify({approved:true,restrictionId:id,auditId:eventId,restored:false,requiresActualRequestVerification:true}));
  }else throw fault('LOCAL_OPERATOR_CONFIRMATION_REQUIRED',403);
}finally{store.close();}
