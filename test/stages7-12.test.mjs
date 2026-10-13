import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

test('step-up uses a trusted compound signal, keeps device denial, and checks freshness', async () => {
  const { normal, suspicious } = fixtureRequests();
  assert.equal((await decide(normal)).decision, 'allow');
  assert.equal((await decide(suspicious)).decision, 'step_up');
  assert.equal((await decide({ ...normal, signals: { ...normal.signals, region: 'foreign' } })).decision, 'allow');
  assert.equal((await decide({ ...suspicious, deviceRegistered: false })).reasonCode, 'device_not_registered');
  for (const age of [0, 60, 900]) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'allow');
  for (const age of [-1, 901, null, '60']) assert.equal((await decide({ ...suspicious, stepUp: { verified: true, authAgeSeconds: age } })).decision, 'step_up');
  for (const signals of [undefined, { ...normal.signals, source: 'client_header' }, { ...normal.signals, hour: undefined }]) {
    assert.equal((await decide({ ...normal, signals })).decision, 'step_up');
  }
  assert.equal((await decide({ ...normal, recentEvents: {} })).decision, 'step_up');
  assert.equal((await decide({ ...normal, signals: { source: 'none', region: 'unknown', network: 'unknown', hour: 12 } })).decision, 'allow');
  assert.equal((await decide({ ...suspicious, recentEvents: [{ kind: 'risk_signal', count: 20, ageSeconds: 601 }] })).decision, 'allow');
});
