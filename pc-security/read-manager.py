"""Runs inside the owned manager. Export only explicitly selected metadata."""
import collections, datetime, json, pathlib, re, sqlite3, subprocess

now = datetime.datetime.now(datetime.timezone.utc)
agents = json.loads(subprocess.check_output(['/var/ossec/bin/agent_control', '-l', '-j']))['data']
agents = [a for a in agents if a.get('name') in ('keshev-mac', 'keshev-windows')]
heartbeats, states, events, counts, system_events = {}, {}, {}, collections.Counter(), collections.deque(maxlen=30)
p = pathlib.Path('/var/ossec/logs/alerts/alerts.json')
if p.exists():
    with p.open('rb') as f:
        size = f.seek(0, 2)
        f.seek(max(0, size - 32_000_000))
        if size > 32_000_000:
            f.readline()
        for line in f:
            try:
                row = json.loads(line.decode('utf-8', errors='replace'))
            except ValueError:
                continue
            aid = row.get('agent', {}).get('id')
            if aid not in [a['id'] for a in agents]:
                continue
            rid = str(row.get('rule', {}).get('id'))
            counts[aid] += 1
            data = row.get('data', {})
            k = data.get('keshev', {})
            at = row.get('timestamp')
            groups = row.get('rule', {}).get('groups', [])
            if not rid.startswith('10012'):
                category = 'file-change' if 'syscheck' in groups else 'configuration-check' if 'sca' in groups else 'system-event'
                system_events.append({'id': row.get('id'), 'agentId': aid, 'at': at, 'rule': rid,
                                      'level': row.get('rule', {}).get('level'), 'category': category})
            if rid == '100123':
                heartbeats[aid] = {'observedAt': k.get('observed_at'), 'receivedAt': at,
                                  'source': k.get('source'), 'coverage': k.get('coverage'),
                                  'flows': k.get('monitored_flows'), 'activeBlocks': k.get('active_blocks'),
                                  'rejectedRows': k.get('rejected_rows'), 'trustedServicesReady': k.get('trusted_services_ready')}
            elif rid == '100124':
                states[(aid, k.get('event_id'))] = {'blocked': k.get('blocked') == 'true', 'observedAt': k.get('observed_at')}
            elif rid == '100121':
                eid = k.get('event_id')
                events[(aid, eid)] = {'id': eid, 'agentId': aid, 'observedAt': k.get('observed_at'),
                                     'rule': rid, 'bytes': k.get('bytes'), 'connections': k.get('count'),
                                     'port': k.get('dstport'), 'protocol': k.get('protocol'), 'response': None}
            elif rid == '100122':
                event = events.get((aid, data.get('EventId')))
                if event:
                    event['response'] = {'command': data.get('Command'), 'effectApplied': data.get('EffectApplied') == 'true',
                                         'at': data.get('At'), 'expiresAt': data.get('ExpiresAt')}

def fresh(at):
    try:
        age = (now - datetime.datetime.fromisoformat(re.sub(r'(\.\d{6})\d+(?=[+-]|Z|$)', r'\1', at).replace('Z', '+00:00'))).total_seconds()
        return -30 <= age <= 45
    except (ValueError, TypeError, AttributeError):
        return False

endpoints = []
for a in agents:
    aid = a['id']
    inventory = {}
    try:
        c = sqlite3.connect('file:/var/ossec/queue/db/' + aid + '.db?mode=ro', uri=True, timeout=1)
        for table, label in [('fim_entry', 'monitoredFiles'), ('sys_programs', 'installedPackages'),
                             ('sys_netiface', 'networkInterfaces'), ('sys_processes', 'processes')]:
            inventory[label] = c.execute('select count(*) from ' + table).fetchone()[0]
        c.close()
    except sqlite3.Error:
        inventory = None
    hb = heartbeats.get(aid)
    live = a['status'] == 'Active' and hb is not None and fresh(hb['observedAt'])
    endpoints.append({'id': aid, 'name': a['name'], 'connection': a['status'], 'telemetry': 'measured' if live else 'unavailable',
                      'heartbeat': hb, 'inventory': inventory, 'receivedAlertsInRecentWindow': counts[aid]})
for (aid, eid), event in events.items():
    state = states.get((aid, eid))
    endpoint = next(e for e in endpoints if e['id'] == aid)
    event['nativeState'] = ('blocked' if state['blocked'] else 'clear') if state and fresh(state['observedAt']) and endpoint['telemetry'] == 'measured' else 'unknown'
    event['nativeObservedAt'] = state['observedAt'] if state else None
print(json.dumps({'schema': 'keshev.pc-security.v1', 'status': 'measured', 'checkedAt': now.isoformat(),
                  'endpoints': endpoints, 'events': list(events.values())[-30:], 'systemEvents': list(system_events),
                  'policy': {'thresholdBytes': 50000000, 'minConnections': 5, 'windowSeconds': 120, 'blockSeconds': 900},
                  'coverage': 'System logs, configured FIM paths, inventory and outbound network metadata. Content inspection is not enabled.',
                  'aiTransmission': False}))
