#!/usr/bin/env python3
"""Create only the owned local manager. Secrets stay in private runtime files/stdin."""
import json, os, secrets, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
LOCAL=ROOT/'.local/pc-security'
NAME='keshev-wazuh-manager'
IMAGE='wazuh/wazuh-manager@sha256:1978757c336ae76a363af0b0fc9975982d08df17b61aac1a69109b3d599f71bd'
def docker(*args,check=True,input=None):
    return subprocess.run(['docker',*args],input=input,capture_output=True,text=True,check=check)
LOCAL.mkdir(parents=True,exist_ok=True,mode=0o700)
password=LOCAL/'enrollment.pass'
if not password.exists():
    fd=os.open(password,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write(secrets.token_urlsafe(48)+'\n')
existing=docker('inspect','--format','{{index .Config.Labels "app.keshev.role"}}',NAME,check=False)
if existing.returncode==0:
    if existing.stdout.strip()!='pc-security-manager':raise SystemExit('MANAGER_NAME_ALREADY_OWNED')
else:
    docker('network','create','keshev-wazuh-transport',check=False)
    args=['create','--name',NAME,'--label','app.keshev.role=pc-security-manager','--network','keshev-wazuh-transport','--init','--restart','unless-stopped','--memory','2g','--cpus','2','--ulimit','nofile=655360:655360','--mount','type=volume,source=keshev-wazuh-data,target=/var/ossec']
    for host in ['127.0.0.1','10.211.55.2']:
        for port in [1514,1515]:args+=['-p',f'{host}:{port}:{port}/tcp']
    args+=['--entrypoint','/bin/bash',IMAGE,'-lc',"if [ ! -f /var/ossec/etc/internal_options.conf ]; then /bin/bash /etc/cont-init.d/0-wazuh-init || exit 1; fi; /var/ossec/bin/wazuh-control start || exit 1; trap '/var/ossec/bin/wazuh-control stop; exit' TERM INT; while :; do sleep 5 & wait $!; done"]
    docker(*args)
docker('cp',str(ROOT/'pc-security/config/local_rules.xml'),NAME+':/var/ossec/etc/rules/keshev_rules.xml')
docker('cp',str(password),NAME+':/var/ossec/etc/authd.pass')
docker('start',NAME)
import time
for _ in range(30):
    ready=docker('exec',NAME,'/bin/test','-f','/var/ossec/etc/internal_options.conf',check=False)
    if ready.returncode==0:break
    time.sleep(1)
else:raise SystemExit('MANAGER_INITIALIZATION_UNAVAILABLE')
# The vendor image has no configured identity in its generated default certificate.
# Create a private CA and a named server certificate once; export only the public CA.
certificates=r'''
set -e
umask 077
cd /var/ossec/etc
if [ ! -f keshev-ca.pem ]; then
 openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 -keyout keshev-ca.key -out keshev-ca.pem -subj /CN=Keshev-Local-Wazuh-CA -addext basicConstraints=critical,CA:TRUE -addext keyUsage=critical,keyCertSign,cRLSign
 openssl req -new -newkey rsa:3072 -nodes -sha256 -keyout sslmanager.key -out keshev-server.csr -subj /CN=10.211.55.2
 printf '%s\n' 'subjectAltName=IP:10.211.55.2,IP:127.0.0.1,DNS:keshev-wazuh-manager' 'basicConstraints=critical,CA:FALSE' 'keyUsage=critical,digitalSignature,keyEncipherment' 'extendedKeyUsage=serverAuth' > keshev-server.ext
 openssl x509 -req -in keshev-server.csr -CA keshev-ca.pem -CAkey keshev-ca.key -CAcreateserial -out sslmanager.cert -days 825 -sha256 -extfile keshev-server.ext
fi
chown root:wazuh sslmanager.key sslmanager.cert keshev-ca.pem
chmod 640 sslmanager.key
chmod 644 sslmanager.cert keshev-ca.pem
'''
docker('exec','-i',NAME,'/bin/sh','-s',input=certificates)
# Configuration is changed inside its own container; no existing endpoint or server config.
script=r'''
import os,xml.etree.ElementTree as E
p='/var/ossec/etc/ossec.conf';root=E.fromstring('<configuration>'+open(p).read()+'</configuration>');r=root.find('ossec_config')
auth=r.find('auth')
if auth is None:auth=E.SubElement(r,'auth')
for k,v in {'disabled':'no','port':'1515','use_password':'yes','ssl_auto_negotiate':'no','ssl_manager_cert':'etc/sslmanager.cert','ssl_manager_key':'etc/sslmanager.key'}.items():
 e=auth.find(k)
 if e is None:e=E.SubElement(auth,k)
 e.text=v
force=auth.find('force')
if force is not None:
 e=force.find('enabled')
 if e is not None:e.text='no'
for tag in ['indexer','vulnerability-detection']:
 e=r.find(tag)
 if e is not None:
  en=e.find('enabled')
  if en is not None:en.text='no'
command=r.find("command[name='keshev-egress']")
if command is None:
 command=E.SubElement(r,'command')
 for k,v in {'name':'keshev-egress','executable':'keshev-egress.exe','timeout_allowed':'yes'}.items():E.SubElement(command,k).text=v
if not any(e.findtext('command')=='keshev-egress' for e in r.findall('active-response')):
 ar=E.SubElement(r,'active-response')
 for k,v in {'command':'keshev-egress','location':'local','rules_id':'100121','timeout':'900'}.items():E.SubElement(ar,k).text=v
open(p,'w').write('\n'.join(E.tostring(child,encoding='unicode') for child in root));os.chmod('/var/ossec/etc/authd.pass',0o640)
api='/var/ossec/api/configuration/api.yaml'
if os.path.exists(api):
 text=open(api).read();open(api,'w').write("host: ['127.0.0.1']\n"+'\n'.join(l for l in text.splitlines() if not l.startswith('host:'))+'\n')
print('private-manager-configuration-applied')
'''
docker('exec','-i',NAME,'/var/ossec/framework/python/bin/python3','-',input=script)
docker('exec',NAME,'/bin/chown','root:wazuh','/var/ossec/etc/authd.pass','/var/ossec/etc/rules/keshev_rules.xml')
docker('exec',NAME,'/var/ossec/bin/wazuh-control','restart')
docker('cp',NAME+':/var/ossec/etc/keshev-ca.pem',str(LOCAL/'manager-ca.pem'))
print(json.dumps({'manager':NAME,'imagePinned':True,'bind':'loopback and Parallels private bridge only','ports':[1514,1515],'rawLogExport':False}))
