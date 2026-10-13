import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {SourceTextModule,createContext} from 'node:vm';
import {detect} from '../src/detect.mjs';
import {checkDetection} from '../scripts/detect-test.mjs';

const start=Date.parse('2026-10-01T00:00:00.000Z');
const reads=(n,subject='opaque-a',interval=1000)=>Array.from({length:n},(_,i)=>({
  at:new Date(start+i*interval).toISOString(),method:'GET',identity:{sub:subject}}));

test('documented detector cases preserve the 120/121 boundary and independent subjects',async()=>{
  assert.ok((await checkDetection(detect)).every(r=>r.passed));
  assert.deepEqual(detect(reads(121,'opaque-a',5000)),{action:'observe'});
  assert.equal(detect(reads(121,'opaque-a',4999)).action,'propose_revocation');
  assert.deepEqual(detect([...reads(80),...reads(80,'opaque-b')]),{action:'observe'});
});

test('only valid pseudonymous GET events count; input order and extra private fields do not leak',()=>{
  const input=reads(121).reverse().map(e=>({...e,content:'private-note',token:'private-token'}));
  const before=JSON.stringify(input);
  assert.deepEqual(detect(input),{action:'propose_revocation',reasonCode:'burst_read',subject:'opaque-a'});
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(detect(reads(200).map(e=>({...e,method:'POST'}))),{action:'observe'});
  assert.deepEqual(detect([null,{},...reads(200).map(e=>({...e,at:'invalid'}))]),{action:'observe'});
  assert.deepEqual(detect(reads(200,'not a pseudonym')),{action:'observe'});
  assert.throws(()=>detect(null),/invalid_detection_events/);
});

test('one earliest qualifying subject is proposed; normal users are never included',()=>{
  const events=[...reads(121,'opaque-later',2000),...reads(121,'opaque-earlier',1000),...reads(120,'opaque-normal')];
  assert.deepEqual(detect(events.reverse()),{action:'propose_revocation',reasonCode:'burst_read',subject:'opaque-earlier'});
});

test('separate detector runs without Node, browser helpers, imports or a wall clock',async()=>{
  const module=new SourceTextModule(await readFile(new URL('../src/detect.mjs',import.meta.url),'utf8'),{context:createContext({})});
  await module.link(()=>{throw Error('unexpected external import');});
  await module.evaluate({timeout:1000});
  const actual=module.namespace.detect(reads(121));
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),detect(reads(121)));
  assert.deepEqual(Object.keys(actual).sort(),['action','reasonCode','subject']);
});
