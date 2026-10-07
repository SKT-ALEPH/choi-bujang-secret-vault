import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

// Exact SHA-256 compatibility for the classifier's non-secret pseudonyms.
export function createHash(algorithm) {
  if (algorithm !== 'sha256') throw new Error('UNSUPPORTED_HASH');
  const hash = sha256.create();
  return {
    update(value) { hash.update(utf8ToBytes(value)); return this; },
    digest(encoding) {
      if (encoding !== 'hex') throw new Error('UNSUPPORTED_ENCODING');
      return bytesToHex(hash.digest());
    },
  };
}
