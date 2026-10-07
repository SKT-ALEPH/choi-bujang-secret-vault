import { isIP } from 'node:net';

export function activeDenyRule(rules, sourceAddress, at) {
  if (!isIP(sourceAddress ?? '') || !Number.isFinite(Date.parse(at))) return null;
  const time = Date.parse(at);
  return rules.find(rule => rule.sourceAddress === sourceAddress
    && rule.action === 'deny' && rule.confidence >= 0.85
    && Number.isFinite(Date.parse(rule.createdAt)) && Number.isFinite(Date.parse(rule.expiresAt))
    && Date.parse(rule.createdAt) <= time && time < Date.parse(rule.expiresAt)
    && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length > 0) ?? null;
}

// Obtain the address from a trusted server-side lookup keyed by requestId.
// Do not add IP fields to the 18-field ZTNA contract or trust browser headers.
export function createXdrGuard(baseDecide, { getTrustedSource, getRules, now = () => new Date().toISOString() }) {
  return async function decide(request) {
    const sourceAddress = await getTrustedSource(request.requestId);
    const rule = activeDenyRule(await getRules(), sourceAddress, now());
    if (rule) return { schema: 'aleph.decision.v1', requestId: request.requestId,
      decision: 'deny', reasonCode: 'xdr_brute_force', ruleIds: ['xdr.brute_force'] };
    return baseDecide(request);
  };
}
