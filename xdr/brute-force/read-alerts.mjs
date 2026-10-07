import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';

export function safeDescription(value) {
  return String(value ?? '').slice(0, 2000)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu, '[redacted]')
    .replace(/\b(?:sb_secret_|sb_publishable_)[A-Za-z0-9_-]+|\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/giu, '[redacted]')
    .replace(/["']?(?:password|passwd|token|secret|api[_-]?key|authorization|cookie|비밀번호|암호)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/giu, '[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[redacted]')
    .replace(/[\r\n\u0000-\u001f]/gu, ' ');
}

// Emit only the five requested fields, never the original data object.
export function normalizeAlert(alert) {
  const rawTime = alert?.timestamp;
  const timestamp = typeof rawTime === 'string' && Number.isFinite(Date.parse(rawTime))
    ? new Date(rawTime).toISOString() : null;
  const source = alert?.data?.srcip;
  const account = alert?.data?.srcuser;
  return {
    timestamp,
    sourceAddress: typeof source === 'string' && isIP(source) ? source : null,
    account: typeof account !== 'string' || !account || account.length > 256 ? '[redacted]'
      : /^user\d{1,8}$/u.test(account) ? account
      : 'opaque:' + createHash('sha256').update(account).digest('hex').slice(0,16),
    level: Number.isInteger(alert?.rule?.level) && alert.rule.level >= 0 && alert.rule.level <= 16 ? alert.rule.level : 0,
    description: safeDescription(alert?.rule?.description),
  };
}

export async function readAlerts(path = new URL('../fixtures/brute-force.json', import.meta.url)) {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  if (fixture.schema !== 'aleph.xdr.fixture.v1' || fixture.moduleKey !== 'brute-force' || !Array.isArray(fixture.alerts)) {
    throw new Error('INVALID_BRUTE_FORCE_FIXTURE');
  }
  return fixture.alerts.map(normalizeAlert);
}
