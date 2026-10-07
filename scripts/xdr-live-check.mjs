import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createDecider } from '../xdr/brute-force/decide.mjs';
import { createJevClient } from '../xdr/brute-force/jev.mjs';

export async function verifyLiveJev({ alerts, askJev }) {
  let modelAnswers = 0, modelRequests = 0;
  const decide = createDecider({ timeoutMs: 10000, askJev: async (summary, options) => {
    modelRequests++;
    const answer = await askJev(summary, options);
    if (typeof answer === 'number' && Number.isFinite(answer) && answer >= 0 && answer <= 1) modelAnswers++;
    return answer;
  } });
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of alerts) {
    counts[(await decide(alert)).action]++;
    if (modelAnswers !== modelRequests) throw new Error('LIVE_JEV_RESPONSE_REQUIRED');
  }
  if (!modelRequests || modelAnswers !== modelRequests) throw new Error('LIVE_JEV_RESPONSE_REQUIRED');
  return { schema: 'aleph.xdr.live-check.v1', moduleKey: 'brute-force',
    mode: 'real_typesafe_api', modelRequests, modelAnswers, counts };
}

export async function runLiveCheck() {
    const statuses = {};
    try {
      await rm(new URL('../public/xdr-live-check.json', import.meta.url), { force: true });
      if (!process.env.TYPESAFE_API_KEY?.trim()) throw new Error('TYPESAFE_API_KEY_REQUIRED');
      const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/brute-force.json', import.meta.url), 'utf8'));
      const proof = await verifyLiveJev({ alerts: fixture.alerts,
        askJev: createJevClient({ enabled: true, onStatus: status => { statuses[status] = (statuses[status] ?? 0) + 1; } }) });
      proof.checkedAt = new Date().toISOString();
      proof.commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
      // Numeric proof only. No keys, tokens, IPs, accounts, descriptions or raw responses.
      await writeFile(new URL('../public/xdr-live-check.json', import.meta.url), JSON.stringify(proof, null, 2) + '\n');
      console.log('Jev real API verification: ' + JSON.stringify(proof));
    } catch (error) {
      console.error(error.message === 'TYPESAFE_API_KEY_REQUIRED'
        ? 'Jev verification failed: TYPESAFE_API_KEY_REQUIRED'
        : 'Jev verification failed: LIVE_JEV_RESPONSE_REQUIRED');
      console.error('Jev response status counts: ' + JSON.stringify(statuses));
      process.exitCode = 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runLiveCheck();
