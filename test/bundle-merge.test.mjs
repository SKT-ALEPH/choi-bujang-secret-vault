import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('bundle records a real merge commit and changes relative to its first parent',async()=>{
 const root=await mkdtemp(join(tmpdir(),'keshev-bundle-merge-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}}).trim();
 try{
  for(const name of ['scripts','src'])await mkdir(join(root,name));
  await copyFile(new URL('../scripts/bundle.mjs',import.meta.url),join(root,'scripts/bundle.mjs'));
  await writeFile(join(root,'.gitignore'),'bundle-notes.json\nartifacts/\n');
  await writeFile(join(root,'aleph.config.json'),JSON.stringify({step:1,repoUrl:'https://github.com/fixture/bundle'}));
  await writeFile(join(root,'src/decider.mjs'),"export const RULE_IDS=['fixture.rule'];");
  await writeFile(join(root,'src/attack-check.mjs'),"export async function runAttackChecks(){return [{attackId:'git-only',expected:'Git metadata only',observed:'not_run: HTTP is outside this Git-only fixture'}]}");
  await writeFile(join(root,'bundle-notes.json'),JSON.stringify({explanation:'Merge metadata reproduction without HTTP or credentials.'}));
  git('init','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');git('remote','add','origin','https://github.com/fixture/bundle');
  git('add','.');git('commit','-m','baseline');git('switch','-c','feature');
  await writeFile(join(root,'feature.txt'),'feature');git('add','.');git('commit','-m','feature');git('switch','main');
  await writeFile(join(root,'main.txt'),'main');git('add','.');git('commit','-m','main');git('merge','--no-ff','feature','-m','merge feature');
  execFileSync(process.execPath,['scripts/bundle.mjs'],{cwd:root,stdio:['ignore','pipe','pipe'],timeout:10000});
  const output=JSON.parse(await readFile(join(root,'artifacts/submission.json'),'utf8'));
  assert.equal(output.commit,git('rev-parse','HEAD'));assert.deepEqual(output.changedFiles,['feature.txt']);
 }finally{await rm(root,{recursive:true,force:true});}
});
