import {readFileSync,writeFileSync,copyFileSync,chmodSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {loadConfig} from './common.mjs';
const c=loadConfig('/config/runtime.json');
copyFileSync('/state/wazuh-enrollment.pass','/var/ossec/etc/authd.pass');chmodSync('/var/ossec/etc/authd.pass',0o640);
spawnSync('chown',['root:wazuh','/var/ossec/etc/authd.pass'],{stdio:'ignore'});
writeFileSync('/var/ossec/etc/ossec.conf',`<ossec_config>
<client><server><address>keshev-wazuh-manager</address><port>1514</port><protocol>tcp</protocol></server>
<enrollment><enabled>yes</enabled><manager_address>keshev-wazuh-manager</manager_address><port>1515</port><agent_name>keshev-local-server-a</agent_name><authorization_pass_path>/var/ossec/etc/authd.pass</authorization_pass_path><server_ca_path>/config/wazuh-ca.pem</server_ca_path></enrollment></client>
<syscheck><disabled>no</disabled><frequency>30</frequency><scan_on_start>yes</scan_on_start><directories check_all="yes" realtime="yes" report_changes="no">/config,/app/server-security</directories></syscheck>
<rootcheck><disabled>yes</disabled></rootcheck>
<wodle name="syscollector"><disabled>no</disabled><interval>1h</interval><scan_on_start>yes</scan_on_start><hardware>yes</hardware><os>yes</os><network>yes</network><packages>yes</packages><ports all="no">yes</ports><processes>yes</processes></wodle>
</ossec_config>`);
const result=spawnSync('/var/ossec/bin/wazuh-control',['start'],{stdio:'ignore'});if(result.status!==0){console.error('SERVER_A_SENSOR_START_FAILED');process.exit(1);}
const child=spawn('setpriv',['--reuid=1000','--regid=1000','--init-groups','node','server-security/server-a.mjs'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
child.once('exit',code=>{spawnSync('/var/ossec/bin/wazuh-control',['stop'],{stdio:'ignore'});process.exitCode=code??1;});
