import {createHash} from 'node:crypto';
export const PROJECT='choi-bujang-secret-vault';
export function projectVaultEvent(row,subjectId,{action=false}={}){
  const event={id:row.id,subjectId,projectId:PROJECT,kind:row.kind,at:row.at,summary:row.summary,
    evidence:row.evidence.map(e=>({...e})),rules:row.rules.map(r=>({...r})),
    state:{access:row.state.access,session:['active','revoked','expired'].includes(row.state.session)?row.state.session:'unknown',device:'unknown'},
    supportedActions:[...row.supportedActions],target:{id:'device:'+row.target.id,generation:row.target.generation}};
  return action?event:{...event,appId:row.appId==='vault'?'vault':undefined};
}
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
export const vaultDigest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function vaultContext(status,subjectId,engineGeneration){
  return {subjectId,projectId:PROJECT,sessionId:status.session.id,identityVersion:status.device.revision,
    appId:'aleph-on',audience:'on-client',accessPolicyId:'netbird-vault',engineGeneration,sourcePolicyVersion:'netbird-'+status.device.revision};
}
