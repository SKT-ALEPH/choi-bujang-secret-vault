import {readFileSync,statSync} from 'node:fs';
export function companyMonitorHealthy(document,agents,policy,now=Date.now()){
  if(!document||document.schema!=='keshev.company-monitor.v1'||!Number.isSafeInteger(document.generatedAt)||document.generatedAt>now+5000||now-document.generatedAt>policy.monitorMaxAgeMs
    ||!Array.isArray(document.agents)||document.agents.length>1000||new Set(document.agents.map(a=>a.id)).size!==document.agents.length||!agents.length)return false;
  return agents.every(id=>document.agents.some(a=>a.id===id&&a.status==='Active'&&Number.isSafeInteger(a.lastKeepAliveAt)&&a.lastKeepAliveAt<=now+5000&&now-a.lastKeepAliveAt<=policy.agentKeepaliveMaxAgeMs));
}
export function readCompanyMonitor(path,agents,policy){
  try{if(statSync(path).size>128000)return false;return companyMonitorHealthy(JSON.parse(readFileSync(path,'utf8')),agents,policy);}catch{return false;}
}
