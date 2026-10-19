import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

test('employee UI retains every controller ID and unique menu/panel wiring', async()=>{
 const html=await read('on-client/public/index.html');
 const ids=[...html.matchAll(/\bid="([^"]+)"/gu)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,'duplicate IDs break event and ARIA bindings');
 for(const file of ['on-client/public/app.js','on-client/public/ai-connect.mjs']){
  const source=await read(file);
  for(const match of source.matchAll(/\$\(['"]([a-z][a-z-]+)['"]\)/gu)) assert.ok(ids.includes(match[1]),`${file}: missing ${match[1]}`);
 }
 for(const view of ['protection','apps','records']){
  assert.ok(ids.includes(`tab-${view}`));assert.ok(ids.includes(`view-${view}`));
  assert.ok(html.includes(`aria-controls="view-${view}"`));
 }
 assert.match(html,/font-src 'self' data:/u);
 assert.match(html,/script-src 'self';/u);assert.match(html,/connect-src 'self';/u);
});

test('vault and offline share canonical theme while offline caching stays restricted',async()=>{
 const [theme,vault,offline,worker]=await Promise.all(['on-client/public/style.css','public/style.css','public/offline.html','public/sw.js'].map(read));
 assert.equal(vault,theme);
 assert.ok(offline.includes(`<style id="shared-theme">${theme}</style>`));
 assert.doesNotMatch(worker,/cache\.put|cache\.addAll/u);
 assert.match(worker,/cache\.add\('\/offline.html'\)/u);
 assert.match(theme,/prefers-reduced-motion:reduce/u);
 assert.match(theme,/color-scheme:light/u);
});

test('semantic foregrounds and actionable boundaries meet measured contrast targets',async()=>{
 const css=await read('on-client/public/style.css');
 const tokens=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})(?=[;\s])/giu)].map(m=>[m[1],m[2]]));
 const luminance=hex=>{const rgb=hex.slice(1).match(/../gu).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
 const contrast=(a,b)=>{const values=[luminance(tokens[a]),luminance(tokens[b])].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05)};
 for(const [a,b] of [['text','bg'],['text','surface'],['muted','bg'],['muted','surface-inset'],['surface','accent'],['allow','allow-soft'],['deny','deny-soft'],['challenge','challenge-soft'],['unknown','unknown-soft']])assert.ok(contrast(a,b)>=4.5,`${a}/${b}: ${contrast(a,b)}`);
 for(const surface of ['bg','surface'])assert.ok(contrast('control-border',surface)>=3,`control border/${surface}: ${contrast('control-border',surface)}`);
});


test('vault layout preserves controller hooks and approval-controlled visibility',async()=>{
 const [html,app]=await Promise.all(['public/index.html','public/app.js'].map(read));
 const ids=[...html.matchAll(/\bid="([^"]+)"/gu)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const match of app.matchAll(/\$\(['"]#([a-z][a-z-]+)['"]\)/gu))assert.ok(ids.includes(match[1]),`missing controller target: ${match[1]}`);
 for(const id of ['auth-panel','device-panel','workspace'])assert.match(html,new RegExp(`<section id="${id}"[^>]*hidden`,'u'));
 assert.match(html,/<p id="status"[^>]*role="status"[^>]*aria-live="polite"/u);
 assert.match(html,/<details id="operations"[^>]*>/u);
 assert.doesNotMatch(html,/<details id="operations"[^>]*\bopen\b/u);
 assert.match(html,/autocomplete="current-password"/u);
 assert.match(html,/id="password"[^>]*aria-describedby="auth-error"/u);
});
