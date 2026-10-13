import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {SourceTextModule, createContext} from 'node:vm';
import {hasEngineRouteDeclarations} from '../src/attack-check.mjs';
import {fixtureRequests} from '../scripts/fixture-7.mjs';
import {decide} from '../src/decider.mjs';
import config from '../aleph.config.json' with {type:'json'};

test('every implemented route declares its service, exact pattern and zone; incomplete or ambiguous declarations fail', () => {
  assert.equal(hasEngineRouteDeclarations(config.allowedRoutes), true);
  for (const field of ['service', 'method', 'path', 'pathPattern', 'zone']) {
    for (let i = 0; i < config.allowedRoutes.length; i++) {
      const routes = structuredClone(config.allowedRoutes);
      delete routes[i][field];
      assert.equal(hasEngineRouteDeclarations(routes), false, `${i}:${field}`);
    }
  }
  const routes = structuredClone(config.allowedRoutes);
  routes[7].zone = 'class-notices';
  assert.equal(hasEngineRouteDeclarations(routes), false);
  assert.equal(hasEngineRouteDeclarations([...config.allowedRoutes, config.allowedRoutes[0]]), false);
  assert.equal(hasEngineRouteDeclarations(config.allowedRoutes.slice(1)), false);
});

test('all eight declarations have matching admission for independent identities and both engine path forms', async () => {
  const {normal}=fixtureRequests();
  for(const route of config.allowedRoutes) {
    for(const prefix of ['/api','']) {
      const pattern=route.pathPattern.replace(/^\/api/,prefix);
      const request={...normal,classId:'independent-class',projectId:'independent-project',
        subjectId:'independent-opaque-subject',deviceId:'123456789abcdef0',policyRevision:42,
        signals:{source:'none',region:'unknown',network:'unknown',hour:14},
        service:route.service,method:route.method,path:pattern.replace(':id',randomUUID()),
        route:`${route.method} ${pattern}`};
      assert.equal((await decide(request)).decision,route.service==='announcements' && route.method==='PUT'?'deny':'allow');
      assert.equal((await decide({...request,path:request.path+'/export'})).decision,'deny');
      assert.equal((await decide({...request,deviceRegistered:false})).decision,'deny');
    }
  }
});

test('isolated policy handles many independent grants and default admission does not depend on the fixture identity', async () => {
  const module = new SourceTextModule(await readFile(new URL('../src/decider.mjs', import.meta.url), 'utf8'),
    {context:createContext({})});
  await module.link(() => {throw Error('external import');});
  await module.evaluate({timeout:1000});
  const {normal} = fixtureRequests();
  const grants = Array.from({length:24}, (_, i) => ({
    source:'none', classId:'synthetic-class', projectId:'synthetic-project',
    subjectId:`synthetic-subject-${i}`, deviceId:(i + 1).toString(16).padStart(16, '0'),
    policyRevision:3, service:i % 2 ? 'announcements' : 'notes',
    path:`/${i % 2 ? 'announcements' : 'notes'}/${randomUUID()}`,
    methods:i % 2 ? ['PUT'] : ['GET', 'PUT'],
  }));
  const decide = module.namespace.createDecider(grants);
  for (let i = 0; i < grants.length; i++) {
    const grant = grants[i];
    const request = {...normal, ...Object.fromEntries(['classId','projectId','subjectId','deviceId','policyRevision','service','path']
      .map(key => [key, grant[key]])), method:grant.methods[0],
      route:`${grant.methods[0]} /${grant.service}/:id`,
      signals:{source:'none',region:'unknown',network:'unknown',hour:14}};
    assert.equal((await decide(request)).decision, 'allow');
    assert.equal((await decide({...request, subjectId:grants[(i + 1) % grants.length].subjectId})).decision, 'deny');
    assert.equal((await decide({...request, path:`/${grant.service}/${randomUUID()}`})).decision, 'deny');
    // Default route admission is data-independent. Data ownership is checked by the API.
    assert.equal((await module.namespace.decide(request)).decision, grant.service==='announcements'?'deny':'allow');
  }
});
