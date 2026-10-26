#!/bin/bash
# Run by the device owner with sudo. Never receives an administrator password.
set -euo pipefail
if [[ $(id -u) != 0 ]]; then echo 'macOS 관리자 인증으로 실행해 주세요.'; exit 1; fi
task_source=$(cd "$(dirname "$0")/.." && pwd)
task_root='/Library/Application Support/KeshevSecurity'
task_agent='/Library/Ossec'
task_package="$task_source/../artifacts/wazuh-pc-2026-10-26/wazuh-agent-4.14.9-1.arm64.pkg"
task_node="$task_source/../artifacts/final-assault-2026-10-26/runtime/node-v24.19.0-darwin-arm64/bin/node"
task_expected='2d42b5803c0d64c20af69f9bc14ad3060d5f9aa42979a00f44506b5a3939f31e802fb35a662761a9a69351db588bac5973834385135754c6197e5afa2bb72a28'
[[ $(shasum -a 512 "$task_package" | cut -d ' ' -f 1) == "$task_expected" ]] || { echo '공식 패키지 해시가 일치하지 않습니다.'; exit 1; }
pkgutil --check-signature "$task_package" | /usr/bin/grep -F 'Wazuh Inc (KLZK8P68R5)' >/dev/null
[[ -f "$task_source/.local/pc-security/manager-ca.pem" && -f "$task_source/.local/pc-security/enrollment.pass" ]] || { echo '전용 서버 준비가 필요합니다.'; exit 1; }
if [[ ! -d "$task_agent" ]]; then
 /usr/bin/python3 - <<'PY'
import os
fd=os.open('/tmp/wazuh_envs',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write("WAZUH_MANAGER='10.211.55.2'\nWAZUH_AGENT_NAME='keshev-mac'\n")
PY
 /usr/sbin/installer -pkg "$task_package" -target /
 # The official package may already remove its own installation environment file.
 if [[ -f /tmp/wazuh_envs && $(stat -f %u /tmp/wazuh_envs) == 0 ]]; then rm -f /tmp/wazuh_envs; fi
fi
if launchctl print system/app.keshev.pc-security >/dev/null 2>&1; then launchctl bootout system/app.keshev.pc-security; fi
install -d -o root -g wheel -m 700 "$task_root"
install -o root -g wheel -m 700 "$task_node" "$task_root/node"
install -o root -g wheel -m 600 "$task_source/pc-security/macos.mjs" "$task_root/macos.mjs"
install -o root -g wazuh -m 640 "$task_source/.local/pc-security/enrollment.pass" "$task_agent/etc/authd.pass"
install -o root -g wazuh -m 644 "$task_source/.local/pc-security/manager-ca.pem" "$task_agent/etc/manager-ca.pem"
task_source="$task_source" task_root="$task_root" /usr/bin/python3 - <<'PY'
import os,json,plistlib,sys,grp
from pathlib import Path
sys.path.insert(0,str(Path(os.environ['task_source'])/'pc-security'))
from configure_macos import configure
root=Path(os.environ['task_root']);agent=Path('/Library/Ossec');conf=agent/'etc/ossec.conf'
backup=conf.with_name('ossec.conf.keshev-original')
if not backup.exists():backup.write_bytes(conf.read_bytes());backup.chmod(0o600)
updated=configure(conf.read_text())
for name in ['network.jsonl','responses.jsonl']:
 p=root/name
 if not p.exists():p.touch(mode=0o600)
temp=conf.with_name('ossec.conf.keshev-next');temp.write_text(updated);temp.chmod(0o640);os.chown(temp,0,grp.getgrnam('wazuh').gr_gid)
os.replace(temp,conf)
p={'thresholdBytes':50000000,'minConnections':5,'windowSeconds':120,'blockSeconds':900,'trustedServices':['chatgpt.com','ab.chatgpt.com','auth.openai.com','api.openai.com'],'trustedDestinations':[{'address':'127.0.0.1','port':0,'protocol':'any'},{'address':'10.211.55.2','port':1514,'protocol':'tcp'},{'address':'10.211.55.2','port':1515,'protocol':'tcp'}]}
(root/'policy.json').write_text(json.dumps(p));(root/'policy.json').chmod(0o600)
ar=agent/'active-response/bin/keshev-egress.exe';ar.write_text('#!/bin/sh\nexec "/Library/Application Support/KeshevSecurity/node" "/Library/Application Support/KeshevSecurity/macos.mjs" response\n');ar.chmod(0o700)
launch={'Label':'app.keshev.pc-security','ProgramArguments':[str(root/'node'),str(root/'macos.mjs'),'sensor'],'RunAtLoad':True,'KeepAlive':True,'StandardOutPath':str(root/'service.log'),'StandardErrorPath':str(root/'service-error.log'),'Umask':63}
with open('/Library/LaunchDaemons/app.keshev.pc-security.plist','wb') as f:plistlib.dump(launch,f)
os.chmod('/Library/LaunchDaemons/app.keshev.pc-security.plist',0o644)
PY
"$task_agent/bin/wazuh-agentd" -t
"$task_agent/bin/wazuh-logcollector" -t
# agentd enrolls after dropping privileges; its dedicated group must read these files.
/usr/bin/sudo -u wazuh /bin/test -r "$task_agent/etc/authd.pass"
/usr/bin/sudo -u wazuh /bin/test -r "$task_agent/etc/manager-ca.pem"
# Reuse the platform's pre-existing application wildcard anchor. No root ruleset reload.
grep -F 'anchor "com.apple/*"' /etc/pf.conf >/dev/null || { echo '기존 PF 구성을 확인해야 합니다. 자동으로 덮어쓰지 않습니다.'; exit 1; }
if [[ ! -f "$task_root/pf-reference" ]]; then
 /sbin/pfctl -E >"$task_root/pf-reference" 2>&1
 chmod 600 "$task_root/pf-reference"
fi
"$task_agent/bin/wazuh-control" restart
launchctl bootstrap system /Library/LaunchDaemons/app.keshev.pc-security.plist
echo 'Mac Wazuh와 읽기 전용 네트워크 송신량 관측을 시작했습니다. 실제 연결·차단 결과는 별도로 검증합니다.'
