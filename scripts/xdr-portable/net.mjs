export function isIP(value) {
  if (typeof value !== 'string') return 0;
  if (/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/u.test(value)) {
    return value.split('.').every(part => Number(part) <= 255) ? 4 : 0;
  }
  if (!value.includes(':') || /[^0-9a-f:.]/iu.test(value)) return 0;
  let address = value;
  if (address.includes('.')) {
    const index = address.lastIndexOf(':');
    if (isIP(address.slice(index + 1)) !== 4) return 0;
    address = address.slice(0, index + 1) + '0:0';
  }
  const halves = address.split('::');
  if (halves.length > 2) return 0;
  const groups = halves.flatMap(half => half === '' ? [] : half.split(':'));
  if (!groups.every(group => /^[0-9a-f]{1,4}$/iu.test(group))) return 0;
  return (halves.length === 2 ? groups.length < 8 : groups.length === 8) ? 6 : 0;
}
