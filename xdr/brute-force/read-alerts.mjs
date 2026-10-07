import { readFile } from 'node:fs/promises';
import { normalizeAlert } from './normalize-alert.mjs';
export { normalizeAlert, safeDescription } from './normalize-alert.mjs';

export async function readAlerts(path = new URL('../fixtures/brute-force.json', import.meta.url)) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'brute-force' || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_BRUTE_FORCE_FIXTURE');
  }
  return fixture.alerts.map(normalizeAlert);
}
