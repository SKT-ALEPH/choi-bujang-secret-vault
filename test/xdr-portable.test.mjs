import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, createContext } from 'node:vm';
import { normalizeAlert } from '../xdr/brute-force/read-alerts.mjs';
import { createDecider } from '../xdr/brute-force/analyze.mjs';
import { createHash } from 'node:crypto';
import { createHash as portableHash } from '../scripts/xdr-portable/crypto.mjs';
import { isIP } from '../scripts/xdr-portable/net.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/brute-force.json', import.meta.url)));

test('standalone evaluator matches source without imports, process, filesystem or network', async () => {
  const source = await readFile(new URL('../xdr/brute-force/decide.mjs', import.meta.url), 'utf8');
  const context = createContext({});
  const module = new SourceTextModule(source, { context });
  await module.link(() => { throw new Error('IMPORT_FORBIDDEN'); });
  await module.evaluate();
  assert.equal(context.process, undefined);
  const original = createDecider();
  const raw = module.namespace.createDecider();
  const extracted = module.namespace.createDecider();
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of fixture.alerts) {
    const expected = await original(alert);
    const result = JSON.parse(JSON.stringify(await raw(alert)));
    assert.deepEqual(result, expected);
    assert.deepEqual(JSON.parse(JSON.stringify(await extracted(normalizeAlert(alert)))), expected);
    counts[result.action]++;
  }
  assert.deepEqual(counts, { block: 10, alert: 9, record: 9 });
  for (const [account, address] of [['가상 사용자 🐈', '2001:db8::1'], ['broken\ud800', '::ffff:192.0.2.1']]) {
    const alert = { ...fixture.alerts[0], data: { srcuser: account, srcip: address } };
    assert.deepEqual(JSON.parse(JSON.stringify(await module.namespace.createDecider()(alert))), await createDecider()(alert));
  }
});

test('portable address validation accepts IP literals and rejects non-address URLs', () => {
  for (const value of ['127.0.0.1', '203.0.113.8']) assert.equal(isIP(value), 4);
  for (const value of ['::1', '2001:db8::1', '::ffff:192.0.2.1']) assert.equal(isIP(value), 6);
  for (const value of ['999.0.0.1', '012.0.0.1', 'example.com', '127.0.0.1/path', '::1]@example.com', '1:2:3']) assert.equal(isIP(value), 0);
});

test('portable UTF-8 hashing matches Node for Unicode and unpaired surrogates', () => {
  for (const value of ['hello', '가상 계정 🐈', 'broken\ud800', 'trailing\udfff']) {
    assert.equal(portableHash('sha256').update(value).digest('hex'), createHash('sha256').update(value).digest('hex'));
  }
});
