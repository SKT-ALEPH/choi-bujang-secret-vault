import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
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
