import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';

test('later-stage metadata preserves the actual Vercel commit identity', () => {
  for (const step of [2,3,4,5]) {
    const identity=deploymentIdentity({VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'Student',
      VERCEL_GIT_REPO_SLUG:'vault',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'vault-test.vercel.app'},
      {step,sampleMarker:'SAMPLE_NOTE_1',judgeIssuer:'https://aleph-judge-production.up.railway.app/defense/judge'});
    assert.equal(identity.step,step);assert.equal(identity.commit,'a'.repeat(40));
  }
});

test('recovery metadata preserves the declared route and rejects an absent restoration declaration',()=>{
  const env={VERCEL_GIT_PROVIDER:'github',VERCEL_GIT_REPO_OWNER:'Student',VERCEL_GIT_REPO_SLUG:'vault',
    VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),VERCEL_URL:'vault-test.vercel.app'};
  const config={step:10,sampleMarker:'SAMPLE_NOTE_1',judgeIssuer:'https://aleph-judge-production.up.railway.app/defense/judge',restoreRoute:'/api/restore/:noteId'};
  assert.equal(deploymentIdentity(env,config).restoreRoute,config.restoreRoute);
  assert.throws(()=>deploymentIdentity(env,{...config,restoreRoute:null}));
});
