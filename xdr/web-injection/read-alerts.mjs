import { readFile } from 'node:fs/promises';
import { normalizeAlert } from '../brute-force/normalize-alert.mjs';
export { normalizeAlert, safeDescription } from '../brute-force/normalize-alert.mjs';
export async function readAlerts(path = new URL('../fixtures/web-injection.json', import.meta.url)) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'web-injection' || !Array.isArray(fixture.alerts)) throw new Error('INVALID_WEB_INJECTION_FIXTURE');
  return fixture.alerts.map(normalizeAlert);
}
