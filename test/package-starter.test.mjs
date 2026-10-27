import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import {execFileSync} from 'node:child_process';

const baseline = JSON.parse(await readFile(new URL('../package/baseline-functions.json', import.meta.url)));

test('패키징 함수 기준표는 12단계의 실제 기존 API와 일치하며 신규 함수는 지정된 두 개뿐이다', async () => {
  const actual = (await readdir(new URL('../api/', import.meta.url),{recursive:true}))
    .filter(name => /\.(?:m?js|ts)$/u.test(name))
    .map(name => join('api', name).replaceAll('\\', '/')).sort();
  assert.equal(baseline.version, 1);
  assert.equal(baseline.starter, 'ChoiTimo/aleph-defense-starter');
  assert.match(baseline.baselineCommit,/^[a-f0-9]{40}$/);
  const historical=execFileSync('git',['ls-tree','-r','--name-only',baseline.baselineCommit,'api'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}).trim().split('\n')
    .filter(file=>/\.(?:m?js|ts)$/.test(file)&&!baseline.allowedNew.includes(file)).sort();
  assert.deepEqual(baseline.functions,historical);
  assert.deepEqual(baseline.allowedNew, ['api/ai.js', 'api/threat-intel.js']);
  assert.deepEqual(actual, [...baseline.functions, ...baseline.allowedNew].sort());
});

test('두 패키지 API는 로그인 없는 요청에서 원천이나 비밀값을 읽기 전에 401로 거부한다', async () => {
  for (const name of ['ai', 'threat-intel']) {
    const { default: handler } = await import(`../api/${name}.js`);
    const headers = new Map();
    let status;
    let body;
    await handler({}, {
      setHeader: (key, value) => headers.set(key.toLowerCase(), value),
      status: value => { status = value; return { json: value => { body = value; } }; },
    });
    assert.equal(status, 401);
    assert.equal(headers.get('cache-control'), 'no-store');
    assert.equal(body.error,'LOGIN_REQUIRED');
  }
});

test('P7 시작 틀 안내는 실제 빌드 조건과 새 배포 시험에 맞는다', async () => {
  const readme = await readFile(new URL('../package/README.md', import.meta.url), 'utf8');
  const selfCheck = await readFile(new URL('../package/SELF-CHECK.md', import.meta.url), 'utf8');
  assert.match(readme, /새 Vercel 프로젝트/u);
  assert.match(readme, /Vercel이 제공하는 저장소·커밋·배포 URL 정보/u);
  assert.doesNotMatch(readme, /npm start/u);
  assert.match(selfCheck, /P7-3\.png/u);
});
