export function isIP(value) {
  if (typeof value !== 'string') return 0;
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/u.test(value)) {
    return value.split('.').every(part => Number(part) <= 255) ? 4 : 0;
  }
  if (!value.includes(':') || /[^0-9a-f:.]/iu.test(value)) return 0;
  try { return new URL(`http://[${value}]/`).hostname.startsWith('[') ? 6 : 0; }
  catch { return 0; }
}
