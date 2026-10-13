import {readFile,writeFile,mkdir,rename,unlink,appendFile,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

export const SAFE_POLICY_HASH = 'e8c09bfe89540f72a82c02d8e7202d670bb782f9311017a639cd1e4eb470c99c';
const backupRoot = new URL('../backups/stage9-safe-policy/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');

export async function loadSafePolicy() {
  const raw = await readFile(new URL('manifest.json', backupRoot));
  if (hash(raw) !== SAFE_POLICY_HASH) throw Error('BACKUP_VERIFICATION_FAILED');
  const manifest = JSON.parse(raw);
  if (manifest.schema !== 'aleph.policy-backup.v1' || manifest.files.length !== 2
      || manifest.files.some(f => !['decider.mjs','detect.mjs'].includes(f.name))) throw Error('BACKUP_VERIFICATION_FAILED');
  const files = [];
  for (const entry of manifest.files) {
    const bytes = await readFile(new URL(entry.name, backupRoot));
    if (hash(bytes) !== entry.sha256) throw Error('BACKUP_VERIFICATION_FAILED');
    files.push({...entry, bytes});
  }
  return {version:manifest.version,sourceCommit:manifest.sourceCommit,policyHash:SAFE_POLICY_HASH,files};
}

export async function initializeTestPolicy(directory) {
  const safe = await loadSafePolicy();
  await mkdir(directory,{recursive:true});
  for (const file of safe.files) {
    try {await writeFile(join(directory,file.name),file.bytes,{flag:'wx'});}
    catch(error) {if(error.code !== 'EEXIST') throw error;}
  }
}

export async function previewTestPolicy(directory) {
  const safe = await loadSafePolicy();
  const changes = [];
  for (const file of safe.files) {
    let current = null;
    try {current = await readFile(join(directory,file.name));}
    catch(error) {if(error.code !== 'ENOENT') throw error;}
    const currentHash = current === null ? null : hash(current);
    if (currentHash !== file.sha256) changes.push({file:file.name,before:currentHash,after:file.sha256});
  }
  const result = {target:'isolated_test_policy',version:safe.version,sourceCommit:safe.sourceCommit,
    policyHash:safe.policyHash,changes};
  return {...result,confirmation:hash(JSON.stringify(result))};
}

export async function applyTestPolicy(directory, confirmation) {
  await mkdir(directory,{recursive:true});
  const lock = join(directory,'.restore-lock');
  await mkdir(lock);
  const staged = [], originals = [];
  try {
    const preview = await previewTestPolicy(directory);
    if (preview.confirmation !== confirmation) throw Error('POLICY_PREVIEW_CHANGED');
    const safe = await loadSafePolicy();
    for (const change of preview.changes) {
      const target = join(directory,change.file),temporary = target+'.'+randomUUID()+'.tmp';
      let previous = null;
      try {previous = await readFile(target);} catch(error) {if(error.code !== 'ENOENT') throw error;}
      originals.push({target,previous});
      await writeFile(temporary,safe.files.find(f=>f.name===change.file).bytes,{flag:'wx'});
      staged.push({temporary,target});
    }
    for (const file of staged) await rename(file.temporary,file.target);
    const after = await previewTestPolicy(directory);
    if (after.changes.length) throw Error('POLICY_RESTORE_VERIFICATION_FAILED');
    await appendFile(join(directory,'audit.jsonl'),JSON.stringify({at:new Date().toISOString(),
      action:'test_policy_restore',version:safe.version,changes:preview.changes})+'\n');
    return {...after,restored:preview.changes.length};
  } catch(error) {
    for (const file of originals) {
      if (file.previous === null) await unlink(file.target).catch(()=>{});
      else await writeFile(file.target,file.previous);
    }
    throw error;
  } finally {
    for (const file of staged) await unlink(file.temporary).catch(()=>{});
    await rmdir(lock);
  }
}
