import { isIP } from 'node:net';

export function activeDenyRule(rules, sourceAddress, at, account = null, destinationAddress = null) {
  if (!Number.isFinite(Date.parse(at))) return null;
  const time = Date.parse(at);
  return rules.find(rule => (rule.destinationAddress !== undefined
      ? isIP(destinationAddress ?? '') && rule.destinationAddress === destinationAddress
      : isIP(sourceAddress ?? '') && rule.sourceAddress === sourceAddress)
    && (rule.account === undefined || rule.account === account)
    && rule.action === 'deny' && Number.isFinite(rule.confidence) && rule.confidence >= 0.85 && rule.confidence <= 1
    && Number.isFinite(Date.parse(rule.createdAt)) && Number.isFinite(Date.parse(rule.expiresAt))
    && Date.parse(rule.createdAt) <= time && time < Date.parse(rule.expiresAt)
    && Array.isArray(rule.evidenceAlertIds) && rule.evidenceAlertIds.length > 0) ?? null;
}

// Obtain the address from a trusted server-side lookup keyed by requestId.
// Do not add IP fields to the 18-field ZTNA contract or trust browser headers.
export function createXdrGuard(baseDecide, { getTrustedSource, getTrustedAccount, getTrustedDestination, getRules,
  denyReasonCode, allowedReasonCodes, now = () => new Date().toISOString() }) {
  if (typeof baseDecide !== 'function' || typeof getTrustedSource !== 'function'
      || typeof getRules !== 'function' || typeof denyReasonCode !== 'string'
      || !Array.isArray(allowedReasonCodes) || !allowedReasonCodes.includes(denyReasonCode)) {
    throw new Error('XDR_OPERATOR_BINDING_REQUIRED');
  }
  return async function decide(request) {
    const base = await baseDecide(request);
    if (base?.decision !== 'allow') return base;
    const sourceAddress = await getTrustedSource(request.requestId);
    const rules = await getRules();
    if (rules.some(rule => rule.account !== undefined) && typeof getTrustedAccount !== 'function') throw Error('XDR_TRUSTED_ACCOUNT_REQUIRED');
    const account = typeof getTrustedAccount === 'function' ? await getTrustedAccount(request.requestId) : null;
    if (rules.some(rule => rule.destinationAddress !== undefined) && typeof getTrustedDestination !== 'function') throw Error('XDR_TRUSTED_DESTINATION_REQUIRED');
    const destination = typeof getTrustedDestination === 'function' ? await getTrustedDestination(request.requestId) : null;
    const rule = activeDenyRule(rules, sourceAddress, now(), account, destination);
    if (rule) return { schema: 'aleph.decision.v1', requestId: request.requestId,
      decision: 'deny', reasonCode: denyReasonCode, ruleIds: [rule.ruleId ?? 'xdr.brute_force'] };
    return base;
  };
}
