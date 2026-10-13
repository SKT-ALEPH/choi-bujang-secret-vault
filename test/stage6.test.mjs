import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
import { connectXdrDecider } from '../src/xdr-decider.mjs';

test('only strictly registered notes reads pass, and XDR can still deny them', async () => {
  const { normal } = fixtureRequests();
  const original = structuredClone(normal);
  assert.equal((await decide(normal)).decision, 'allow');
  for (const deviceRegistered of [false, undefined, null, 'true', 1]) {
    const input = { ...normal, deviceRegistered };
    const result = await decide(input);
    assert.equal(result.decision, 'deny');
    assert.equal(result.reasonCode, 'device_not_registered');
    assert.deepEqual(result.ruleIds, ['device_registered']);
    assert.equal(result.requestId, input.requestId);
    assert.deepEqual(Object.keys(result).sort(), ['decision', 'reasonCode', 'requestId', 'ruleIds', 'schema']);
  }
  for (const fields of [{ method: 'POST' }, { service: 'other' }, { route: 'GET /admin' }]) {
    assert.equal((await decide({ ...normal, ...fields })).decision, 'deny');
  }
  const connected = connectXdrDecider({ getTrustedSource: async () => '192.0.2.120',
    getRules: async () => [{ ruleId: 'xdr.web_injection', action: 'deny', sourceAddress: '192.0.2.120',
      confidence: 0.96, createdAt: '2026-10-13T00:00:00Z', expiresAt: '2026-10-13T00:15:00Z',
      evidenceAlertIds: ['fixture-evidence'] }],
    denyReasonCode: 'xdr_brute_force', allowedReasonCodes: ['xdr_brute_force'],
    now: () => '2026-10-13T00:01:00Z' });
  const blocked = await connected.decide(normal);
  assert.equal(blocked.decision, 'deny');
  assert.deepEqual(blocked.ruleIds, ['xdr.web_injection']);
  assert.deepEqual(normal, original);
});
