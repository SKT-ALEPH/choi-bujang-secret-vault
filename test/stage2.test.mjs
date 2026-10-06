import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';

test('later-stage metadata preserves the actual Vercel commit identity', () => {
  for (const step of [2,3]) {
    const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'Student',
      VERCEL_GIT_REPO_SLUG:'vault',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'vault-test.vercel.app'},
      {step,sampleMarker:'SAMPLE_NOTE_1',judgeIssuer:'https://aleph-judge-production.up.railway.app/defense/judge'});
    assert.equal(identity.step,step);assert.equal(identity.commit,'a'.repeat(40));
  }
});
