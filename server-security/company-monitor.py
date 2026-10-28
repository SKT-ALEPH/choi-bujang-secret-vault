#!/usr/bin/env python3
"""Run in the manager only. Publish selected agents' liveness without keys, names or IPs."""
import json, os, re, subprocess, sys, time
ids = sys.argv[1:]
if not ids or len(ids) > 1000 or any(not re.fullmatch(r'[0-9]{3,6}', x) for x in ids):
    raise SystemExit('REGISTERED_COMPANY_AGENTS_REQUIRED')
agents = []
for agent_id in ids:
    result = subprocess.run(['/var/ossec/bin/agent_control', '-i', agent_id, '-j'], capture_output=True, text=True, timeout=5, check=True)
    data = json.loads(result.stdout)['data']
    agents.append({'id': agent_id, 'status': 'Active' if data.get('status') == 'Active' else 'Unavailable', 'lastKeepAliveAt': int(data.get('lastKeepAlive') or 0) * 1000})
payload = {'schema': 'keshev.company-monitor.v1', 'generatedAt': int(time.time() * 1000), 'agents': agents}
path = '/var/ossec/logs/alerts/keshev-company-status.json'
with open(path + '.tmp', 'w', encoding='utf8') as out:
    os.chmod(path + '.tmp', 0o644)
    json.dump(payload, out)
os.replace(path + '.tmp', path)
