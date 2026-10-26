import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';

test('actual Mac policy trusts only approved, freshly resolved service addresses on 443; other destinations remain enforceable',async()=>{
 const url=new URL('../pc-security/macos.mjs',import.meta.url),calls=[];
 const source=await readFile(url,'utf8');
 // Expose private helpers only in this isolated test module, never in the installed service.
 const context=createContext({process,setTimeout,clearTimeout,console,Buffer});
 const module=new SourceTextModule(source+'\nexport {refreshServices,trustedService,serviceAddresses};',{context,identifier:url.href,initializeImportMeta:meta=>{meta.url=url.href;}});
 await module.link(async name=>{
  const ns={...await import(name)};
  if(name==='node:dns/promises')ns.lookup=async host=>{calls.push(host);return [{address:'192.0.2.60',family:4}];};
  const child=new SyntheticModule(Object.keys(ns),function(){for(const [k,v]of Object.entries(ns))this.setExport(k,v);},{context});return child;
 });
 await module.evaluate();const m=module.namespace;
 const policy={trustedServices:['chatgpt.com','unapproved.invalid'],trustedDestinations:[]};
 assert.equal(m.trustedService('192.0.2.60',443,policy),false);
 await m.refreshServices(policy);assert.deepEqual(calls,['chatgpt.com']);
 assert.equal(m.trustedService('192.0.2.60',443,policy),true);
 assert.equal(m.eligible('192.0.2.60',443,'tcp',policy),false);
 assert.equal(m.eligible('192.0.2.60',58443,'tcp',policy),true);
 assert.equal(m.eligible('192.0.2.61',443,'tcp',policy),true);
 m.serviceAddresses.set('chatgpt.com',{at:Date.now()-300001,addresses:['192.0.2.60']});
 assert.equal(m.trustedService('192.0.2.60',443,policy),false);
 assert.equal(m.eligible('192.0.2.60',443,'tcp',policy),true);
});
