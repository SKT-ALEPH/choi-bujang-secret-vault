import {spawn} from 'node:child_process';
import {mkdir, stat, rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const source = fileURLToPath(new URL('./native/keychain.swift', import.meta.url));
const directory = fileURLToPath(new URL('./.local/', import.meta.url));
const binary = join(directory, 'keshev-keychain');

function run(file, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {stdio: ['pipe', 'pipe', 'ignore']});
    const chunks = [];
    let length = 0;
    const timer = setTimeout(() => child.kill(), 60_000);
    child.stdout.on('data', data => {
      length += data.length;
      if (length > 2 * 1024 * 1024) child.kill();
      else chunks.push(data);
    });
    child.once('error', () => { clearTimeout(timer); reject(Error('KEYCHAIN_UNAVAILABLE')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(Error('KEYCHAIN_UNAVAILABLE'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

export async function keychainEncryption() {
  if (process.platform !== 'darwin') throw Error('PERSONAL_AI_MAC_REQUIRED');
  await mkdir(directory, {recursive: true, mode: 0o700});
  const compiled = await stat(binary).catch(() => null);
  if (!compiled || compiled.mtimeMs < (await stat(source)).mtimeMs) {
    const temporary = binary + '.build';
    await run('/usr/bin/xcrun', ['swiftc', source, '-o', temporary]);
    await rename(temporary, binary);
  }
  return {
    id: 'keshev-macos-keychain-aesgcm-v1',
    isAvailable: () => true,
    encrypt: value => run(binary, ['encrypt'], Buffer.from(value, 'utf8')),
    decrypt: async value => (await run(binary, ['decrypt'], value)).toString('utf8'),
  };
}
