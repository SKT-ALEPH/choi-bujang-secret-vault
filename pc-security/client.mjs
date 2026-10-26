import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const run=promisify(execFile),manager='keshev-wazuh-manager';
export async function readPcSecurity(){
 try{
  const role=await run('docker',['inspect','--format','{{index .Config.Labels "app.keshev.role"}}',manager],{timeout:3000,maxBuffer:1024});
  if(role.stdout.trim()!=='pc-security-manager')throw Error('MANAGER_NOT_OWNED');
  const source=await readFile(new URL('./read-manager.py',import.meta.url),'utf8');
  const result=await new Promise((resolve,reject)=>{
   const child=spawn('docker',['exec','-i',manager,'/var/ossec/framework/python/bin/python3','-'],{stdio:['pipe','pipe','pipe']});
   let output='',length=0;const timer=setTimeout(()=>{child.kill();reject(Error('MANAGER_TIMEOUT'));},10000);
   child.stdout.on('data',b=>{length+=b.length;if(length>262144){child.kill();reject(Error('MANAGER_OUTPUT_LIMIT'));}else output+=b.toString('utf8');});
   child.stderr.resume();child.on('error',e=>{clearTimeout(timer);reject(e);});
   child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error('MANAGER_UNAVAILABLE'));});child.stdin.on('error',()=>{});child.stdin.end(source);
  });
  const d=JSON.parse(result);if(d.schema!=='keshev.pc-security.v1'||!Array.isArray(d.endpoints)||!Array.isArray(d.events))throw Error('OBSERVATION_INVALID');return d;
 }catch{return {schema:'keshev.pc-security.v1',status:'unavailable',checkedAt:new Date().toISOString(),endpoints:[],events:[],aiTransmission:false};}
}
