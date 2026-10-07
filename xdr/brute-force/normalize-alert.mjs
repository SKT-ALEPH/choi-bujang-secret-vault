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
  // Accept either a Wazuh row or the reader's five-field output. Keep the
  // formats separate so a partially supplied raw row cannot mix in flat data.
  const raw = alert?.data !== undefined || alert?.rule !== undefined;
  const source = raw ? alert?.data?.srcip : alert?.sourceAddress;
  const account = raw ? alert?.data?.srcuser : alert?.account;
  const level = raw ? alert?.rule?.level : alert?.level;
  const description = raw ? alert?.rule?.description : alert?.description;
  return {
    timestamp,
    sourceAddress: typeof source === 'string' && isIP(source) ? source : null,
    account: typeof account !== 'string' || !account || account.length > 256 || account === '[redacted]' ? '[redacted]'
      : /^user\d{1,8}$/u.test(account) || (!raw && /^opaque:[a-f0-9]{16}$/u.test(account)) ? account
      : 'opaque:' + createHash('sha256').update(account).digest('hex').slice(0,16),
    level: Number.isInteger(level) && level >= 0 && level <= 16 ? level : 0,
    description: safeDescription(description),
  };
}

