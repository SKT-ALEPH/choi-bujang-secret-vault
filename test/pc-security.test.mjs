import test from 'node:test';import assert from 'node:assert/strict';
import {parseConnection,eligible,blockDeadline} from '../pc-security/macos.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('Mac installer preserves Wazuh raw command syntax and changes only its own sections idempotently',()=>{
 const source=`import sys\nsys.path.insert(0,sys.argv[1])\nfrom configure_macos import configure\ns='<ossec_config><client><server><address>old</address></server></client><localfile><command>test a && test b</command></localfile></ossec_config>'\nr=configure(s)\nassert configure(r)==r\nassert '<command>test a && test b</command>' in r\nassert '&amp;' not in r\nassert r.count('network.jsonl')==1\nassert '10.211.55.2' in r\n`;
 const result=spawnSync('/usr/bin/python3',['-c',source,fileURLToPath(new URL('../pc-security/',import.meta.url))],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('native nettop parser uses socket counters; malformed/listening rows and protected destinations cannot become a block target',()=>{
 const row=parseConnection('tcp4 192.0.2.1:5000<->192.0.2.2:58443,16,123456,');
 assert.equal(row.bytes,123456);assert.equal(row.address,'192.0.2.2');assert.equal(row.port,58443);
 assert.equal(parseConnection('tcp4 *:58443<->*:*,0,5,'),null);
 assert.equal(parseConnection('node.42,0,123,'),null);
 const p={trustedDestinations:[{address:'192.0.2.2',port:1514,protocol:'tcp'}]};
 assert.equal(eligible('192.0.2.2',1514,'tcp',p),false);assert.equal(eligible('192.0.2.2',58443,'tcp',p),true);
 for(const address of ['127.0.0.1','127.0.0.2','::1','::ffff:127.0.0.2','command;other'])assert.equal(eligible(address,58443,'tcp',p),false);
});
test('restoring an unexpired native block preserves its original deadline',()=>{
 const now=Date.parse('2026-10-26T10:00:00Z'),p={Command:'add',EventId:'event',ExpiresAt:'2026-10-26T10:10:00Z'};
 assert.equal(blockDeadline(p,'event',now,900),p.ExpiresAt);
 assert.equal(blockDeadline(p,'different-event',now,900),'2026-10-26T10:15:00.000Z');
 assert.equal(blockDeadline({...p,Command:'delete'},'event',now,900),'2026-10-26T10:15:00.000Z');
});
