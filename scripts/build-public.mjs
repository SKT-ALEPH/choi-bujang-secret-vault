import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'data.json');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
const data = JSON.parse(await readFile(source, 'utf8'));
if (!Array.isArray(data.notes)) {
  throw new Error('실습용 공개 자료 형식을 확인하세요. 실제 학생 자료를 넣으면 안 됩니다.');
}
await mkdir(resolve(root, 'public'), { recursive: true });
if (config.step === 1) {
  await copyFile(source, output);
} else if (config.step >= 2 && config.step <= 12) {
  if (data.notes.length !== 0) throw new Error('2단계부터 공개 data.json에 메모가 남으면 안 됩니다.');
  await writeFile(output, `${JSON.stringify({ notes: [] }, null, 2)}\n`, 'utf8');
} else {
  throw new Error('현재 단계를 확인하세요.');
}
if (config.step >= 3) {
  await mkdir(resolve(root, 'public', 'vendor'), { recursive: true });
  await copyFile(resolve(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),
    resolve(root, 'public/vendor/supabase.js'));
}
if (config.step >= 5) {
  const settings = JSON.parse(await readFile(resolve(root, 'config/supabase-public.json'), 'utf8'));
  await writeFile(resolve(root, 'public/auth-config.json'), `${JSON.stringify({url:settings.url})}\n`, 'utf8');
}
console.log('현재 단계의 정적 자료 파일을 준비했습니다.');
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
if (process.env.XDR_VERIFY_JEV === '1') {
  const { runLiveCheck } = await import('./xdr-live-check.mjs');
  await runLiveCheck();
}

// Explicit server-only fixture workflow. Never run against the previous deployment.
if(config.step===12&&process.env.STAGE11_VERIFY_DEVICE==='1'){
  const deployed=await(await fetch(new URL('/aleph.json',config.publicAppUrl),{cache:'no-store',redirect:'error'})).json();
  if(deployed.commit===process.env.VERCEL_GIT_COMMIT_SHA){
    const {execFileSync}=await import('node:child_process');
    execFileSync(process.execPath,['--experimental-vm-modules','scripts/stage11-live-check.mjs'],{stdio:'inherit'});
  }else console.log('12단계 첫 배포: 같은 커밋 배포 이후 명시 재배포에서만 실측합니다.');
}
