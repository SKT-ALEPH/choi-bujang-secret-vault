import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const manager='keshev-wazuh-manager',c=JSON.parse(readFileSync('.local/server-redesign/runtime/config/runtime.json'));
const ids=(c.registeredAgents??[]).map(a=>a.agentId);
if(!ids.length||ids.some(id=>!/^\d{3,6}$/.test(id)))throw Error('REGISTERED_COMPANY_AGENTS_REQUIRED');
const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "app.keshev.role"}}',manager],{encoding:'utf8'}).trim();
if(label!=='pc-security-manager')throw Error('OWNED_MANAGER_REQUIRED');
for(const id of ids){const x=JSON.parse(execFileSync('docker',['exec',manager,'/var/ossec/bin/agent_control','-i',id,'-j'],{encoding:'utf8'}));if(x.data?.status!=='Active')throw Error('COMPANY_AGENT_NOT_ACTIVE');}
const source=new URL('./company-monitor.py',import.meta.url),destination='/var/ossec/integrations/keshev-company-status.py',checksum=createHash('sha256').update(readFileSync(source)).digest('hex');
execFileSync('docker',['cp',source.pathname,manager+':'+destination]);
execFileSync('docker',['exec',manager,'chmod','750',destination]);
const module=`<wodle name="command">\n  <disabled>no</disabled><tag>keshev-company-status</tag>\n  <command>${destination} ${ids.join(' ')}</command>\n  <interval>10s</interval><ignore_output>yes</ignore_output><run_on_start>yes</run_on_start><timeout>15</timeout>\n  <verify_sha256>${checksum}</verify_sha256>\n</wodle>`;
const install=`import os,re,xml.etree.ElementTree as E,subprocess\nfrom pathlib import Path\np=Path('/var/ossec/etc/ossec.conf');s=p.read_text();old=s\nE.fromstring('<root>'+s+'</root>')\nfor block in re.findall(r'<wodle\\b[^>]*>.*?</wodle>',s,re.S):\n if '<tag>keshev-company-status</tag>' in block:s=s.replace(block,'')\nauth=re.search(r'<auth>.*?</auth>',s,re.S)\nif auth:\n block=auth.group();replacement=re.sub(r'<disabled>.*?</disabled>','<disabled>yes</disabled>',block,flags=re.S)\n if replacement==block and '<disabled>' not in block:replacement=block.replace('<auth>','<auth><disabled>yes</disabled>',1)\n s=s[:auth.start()]+replacement+s[auth.end():]\nelse:raise RuntimeError('EXISTING_ENROLLMENT_CONFIG_REQUIRED')\nindex=s.rfind('</ossec_config>')\nif index<0:raise RuntimeError('MANAGER_CONFIG_REQUIRED')\ns=s[:index]+${JSON.stringify(module)}+'\\n'+s[index:]\nE.fromstring('<root>'+s+'</root>')\nb=p.with_name('ossec.conf.keshev-monitor.bak')\nif not b.exists():b.write_text(old);os.chmod(b,0o600)\nmeta=p.stat();t=p.with_name('ossec.conf.keshev-monitor.tmp');t.write_text(s);os.chmod(t,meta.st_mode & 0o777);os.chown(t,meta.st_uid,meta.st_gid);os.replace(t,p)\ntry:subprocess.run(['/var/ossec/bin/wazuh-modulesd','-t'],check=True,capture_output=True,timeout=10)\nexcept Exception:p.write_text(old);raise RuntimeError('MANAGER_CONFIG_REJECTED')\n`;
const applied=spawnSync('docker',['exec','-i',manager,'python3','-'],{input:install,encoding:'utf8',timeout:20000});
if(applied.status!==0)throw Error('MANAGER_MONITOR_SETUP_FAILED');
execFileSync('docker',['exec',manager,destination,...ids],{stdio:'ignore'});
execFileSync('docker',['restart',manager],{stdio:'ignore',timeout:40000});
console.log(JSON.stringify({managerMonitorInstalled:true,registeredAgents:ids.length,metadataOnly:true,newEnrollmentDisabled:true,existingAgentKeysPreserved:true}));
