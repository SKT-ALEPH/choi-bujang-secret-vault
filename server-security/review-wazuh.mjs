import {openStore} from './store.mjs';
import {uuid} from './common.mjs';
const [action,id,confirmation]=process.argv.slice(2),s=openStore('/state/server-b.sqlite');
try{
  if(action==='list')console.log(JSON.stringify(s.db.prepare("SELECT id,request_id,at,data FROM events WHERE source='wazuh' ORDER BY at DESC LIMIT 50").all().map(e=>{const x=JSON.parse(e.data);return {id:e.id,sourceEventId:e.request_id,at:e.at,ruleId:x.ruleId,level:x.level,fileHash:x.fileHash};})));
  else if(action==='acknowledge'&&uuid(id)&&confirmation==='--confirm-local-operator'){
    const row=s.db.prepare("SELECT id FROM events WHERE id=? AND source='wazuh'").get(id);if(!row)throw Error('OBSERVATION_NOT_FOUND');
    s.db.prepare('INSERT INTO acknowledged_observations VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(id,Date.now());
    s.event('local-operator',{kind:'observation-reviewed',evidenceIds:[id],reasonCode:'LOCAL_OPERATOR_REVIEW'});console.log(JSON.stringify({reviewed:true,eventId:id,historyPreserved:true,accessRestored:false}));
  }else throw Error('LOCAL_OPERATOR_CONFIRMATION_REQUIRED');
}finally{s.close();}
