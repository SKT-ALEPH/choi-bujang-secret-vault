import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import policy from './patterns.json' with { type: 'json' };
import { normalizeAlert } from './read-alerts.mjs';
import { connectXdrDecider } from '../../src/xdr-decider.mjs';
import { fixtureRequests } from '../../scripts/fixture-7.mjs';
import { addDenyRules, readDenyRules } from '../brute-force/rule-store.mjs';

const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_.-]{0,79}$/iu.test(value) ? value : null;

export async function respond({ root, result, alerts }) {
  const rules = [];
  const notices = [];
  const indexed = new Map(alerts.map(alert => [alert.id, alert]));
  for (const entry of result.decisions) {
    const id = safeId(entry.alertId);
    const alert = indexed.get(entry.alertId);
    if (!id || !alert) continue;
    if (entry.action === 'alert') notices.push(JSON.stringify({ module: 'privilege', alertId: id,
      action: 'alert', confidence: entry.confidence, pattern: 'possible_privilege_change' }));
    if (entry.action !== 'block' || entry.confidence < policy.thresholds.block) continue;
    const normalized = normalizeAlert(alert);
    if (!normalized.sourceAddress || !normalized.timestamp || normalized.account === '[redacted]') continue;
    rules.push({ ruleId: 'xdr.privilege', action: 'deny', sourceAddress: normalized.sourceAddress, account: normalized.account,
      createdAt: normalized.timestamp,
      expiresAt: new Date(Date.parse(normalized.timestamp) + policy.blockTtlSeconds * 1000).toISOString(),
      confidence: entry.confidence, evidenceAlertIds: [id] });
  }
  const logPath = join(root, 'xdr', 'alerts.log');
  let existing = '';
  try { existing = await readFile(logPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const known = new Set(existing.split('\n'));
  const fresh = notices.filter(line => !known.has(line));
  if (fresh.length) await appendFile(logPath, fresh.join('\n') + '\n');
  const rulesPath = join(root, 'xdr/privilege/deny-rules.json');
  await addDenyRules(rulesPath, rules);

  // Replay the real base decider and its added guard with public-contract synthetic requests.
  let blockedCandidates = 0, normalEventsBlocked = 0, normalEventsPassed = 0;
  for (const entry of result.decisions) {
    const alert = normalizeAlert(indexed.get(entry.alertId));
    const guarded = connectXdrDecider({
      getTrustedSource: async () => alert.sourceAddress, getTrustedAccount: async () => alert.account, getRules: () => readDenyRules(rulesPath),
      denyReasonCode: 'xdr_privilege', allowedReasonCodes: ['xdr_privilege'],
      now: () => alert.timestamp,
    });
    const out = await guarded.decide({ ...fixtureRequests().normal, requestId: entry.alertId });
    if (entry.action === 'block' && out.decision === 'deny') blockedCandidates++;
    if (entry.action === 'record') {
      if (out.decision === 'deny') normalEventsBlocked++; else normalEventsPassed++;
    }
  }
  await writeFile(join(root, 'xdr/privilege/verification.json'), JSON.stringify({
    mode: 'fixture_replay_with_real_base_decider', alertsRead: alerts.length,
    blockCandidates: rules.length, blockedCandidates, normalEventsBlocked, normalEventsPassed,
    productionEngineConnected: false,
  }, null, 2) + '\n');
}
