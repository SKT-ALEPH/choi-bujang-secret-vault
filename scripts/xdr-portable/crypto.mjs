import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

// Exact SHA-256 compatibility for the classifier's non-secret pseudonyms.
export function createHash(algorithm) {
  if (algorithm !== 'sha256') throw new Error('UNSUPPORTED_HASH');
  const hash = sha256.create();
  return {
    update(value) { hash.update(utf8(value)); return this; },
    digest(encoding) {
      if (encoding !== 'hex') throw new Error('UNSUPPORTED_ENCODING');
      return bytesToHex(hash.digest());
    },
  };
}

// Standard UTF-8, including replacement of unpaired UTF-16 surrogates.
// This also works in an evaluator without browser TextEncoder.
function utf8(value) {
  const bytes = [];
  for (const character of value) {
    let point = character.codePointAt(0);
    if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
    if (point < 0x80) bytes.push(point);
    else if (point < 0x800) bytes.push(0xc0 | point >> 6, 0x80 | point & 63);
    else if (point < 0x10000) bytes.push(0xe0 | point >> 12, 0x80 | point >> 6 & 63, 0x80 | point & 63);
    else bytes.push(0xf0 | point >> 18, 0x80 | point >> 12 & 63, 0x80 | point >> 6 & 63, 0x80 | point & 63);
  }
  return Uint8Array.from(bytes);
}
