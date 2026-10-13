import { readFile } from 'node:fs/promises';
import { normalizeAlert } from '../brute-force/normalize-alert.mjs';
export { normalizeAlert } from '../brute-force/normalize-alert.mjs';
export async function readAlerts(path = new URL('../fixtures/exfiltration.json', import.meta.url)) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'exfiltration' || !Array.isArray(fixture.alerts)) throw Error('INVALID_EXFILTRATION_FIXTURE');
  return fixture.alerts.map(normalizeAlert);
}
