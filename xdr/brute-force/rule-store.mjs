import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import policy from './patterns.json' with { type: 'json' };

const safeId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_.-]{0,79}$/iu.test(id);
const fields = 'action,confidence,createdAt,evidenceAlertIds,expiresAt,ruleId,sourceAddress';

function validRule(rule) {
  const start = Date.parse(rule?.createdAt), end = Date.parse(rule?.expiresAt);
  return rule && Object.keys(rule).sort().join(',') === fields
    && rule.ruleId === 'xdr.brute_force' && rule.action === 'deny'
    && isIP(rule.sourceAddress ?? '') && Number.isFinite(rule.confidence)
    && rule.confidence >= policy.thresholds.block && rule.confidence <= 1
    && Number.isFinite(start) && Number.isFinite(end) && end > start
    && end - start <= policy.blockTtlSeconds * 1000
    && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length > 0
    && rule.evidenceAlertIds.length <= 128 && rule.evidenceAlertIds.every(safeId);
}

// Private local/server storage, with one writer. Missing file means no rules;
// malformed files fail rather than silently allowing traffic.
export async function readDenyRules(path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw new Error('XDR_RULE_STORE_UNAVAILABLE'); }
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value.rules) || value.rules.length > 10000 || !value.rules.every(validRule)) throw new Error();
    return value.rules;
  } catch { throw new Error('XDR_RULE_STORE_INVALID'); }
}

export async function addDenyRules(path, candidates) {
  if (!Array.isArray(candidates) || !candidates.every(validRule)) throw new Error('XDR_RULE_STORE_INVALID');
  const rules = await readDenyRules(path);
  const identity = rule => JSON.stringify([rule.sourceAddress, rule.createdAt, rule.expiresAt, rule.evidenceAlertIds]);
  const known = new Set(rules.map(identity));
  for (const rule of candidates) {
    if (!known.has(identity(rule))) { rules.push(rule); known.add(identity(rule)); }
  }
  if (rules.length > 10000) throw new Error('XDR_RULE_STORE_FULL');
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify({ rules }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
  return rules;
}
