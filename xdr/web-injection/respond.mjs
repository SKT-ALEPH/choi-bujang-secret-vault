import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import policy from './patterns.json' with { type: 'json' };
import { normalizeAlert } from './read-alerts.mjs';
import { createXdrGuard } from '../brute-force/guard.mjs';
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
    if (entry.action === 'alert') notices.push(JSON.stringify({ module: 'web-injection', alertId: id,
      action: 'alert', confidence: entry.confidence, pattern: 'ambiguous_web_input' }));
    if (entry.action !== 'block' || entry.confidence < policy.thresholds.block) continue;
    const normalized = normalizeAlert(alert);
    if (!normalized.sourceAddress || !normalized.timestamp) continue;
    rules.push({ ruleId: 'xdr.web_injection', action: 'deny', sourceAddress: normalized.sourceAddress,
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
  const rulesPath = join(root, 'xdr/web-injection/deny-rules.json');
  await addDenyRules(rulesPath, rules);

  // Replay the guard with a known allow baseline, separately from the existing
  // starter.deny. This proves the added component does not block normal events.
  let blockedCandidates = 0, normalEventsBlocked = 0, normalEventsPassed = 0;
  for (const entry of result.decisions) {
    const alert = normalizeAlert(indexed.get(entry.alertId));
    const guarded = createXdrGuard(async request => ({ schema: 'aleph.decision.v1', requestId: request.requestId,
      decision: 'allow', reasonCode: 'approved', ruleIds: [] }), {
      getTrustedSource: async () => alert.sourceAddress, getRules: () => readDenyRules(rulesPath),
      denyReasonCode: 'xdr_web_injection', allowedReasonCodes: ['xdr_web_injection'],
      now: () => alert.timestamp,
    });
    const out = await guarded({ requestId: entry.alertId });
    if (entry.action === 'block' && out.decision === 'deny') blockedCandidates++;
    if (entry.action === 'record') {
      if (out.decision === 'deny') normalEventsBlocked++; else normalEventsPassed++;
    }
  }
  await writeFile(join(root, 'xdr/web-injection/verification.json'), JSON.stringify({
    mode: 'fixture_replay_with_allow_baseline', alertsRead: alerts.length,
    blockCandidates: rules.length, blockedCandidates, normalEventsBlocked, normalEventsPassed,
    jev: { liveRequested: process.env.XDR_JEV_LIVE === '1',
      modelAnswers: result.decisions.filter(entry => entry.reason === 'ambiguous_web_input: Jev 판단').length,
      fallbackAlerts: result.decisions.filter(entry => entry.reason.includes('Jev 응답 없음')).length },
    productionEngineConnected: false,
  }, null, 2) + '\n');
}
