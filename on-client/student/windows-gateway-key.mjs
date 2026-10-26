import {generateKeyPairSync,createPrivateKey,createPublicKey} from 'node:crypto';
import {mkdir,readFile,writeFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {execFile} from 'node:child_process';

// DPAPI input/output stays inside this application; never print key material.
function dpapi(operation,value){
  if(process.platform!=='win32')throw Error('WINDOWS_DPAPI_REQUIRED');
  const expression=operation==='protect'?'Protect':'Unprotect';
  const script="Add-Type -AssemblyName System.Security;$v=[Convert]::FromBase64String([Console]::In.ReadToEnd());$r=[Security.Cryptography.ProtectedData]::"+expression+"($v,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($r))";
  return new Promise((resolve,reject)=>{
    const child=execFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
      {timeout:10000,maxBuffer:32768,windowsHide:true},(error,stdout)=>{
        if(error||!/^[A-Za-z0-9+/=]+$/.test(stdout)){reject(Error('GATEWAY_KEY_UNAVAILABLE'));return;}
        resolve(Buffer.from(stdout,'base64'));
      });
    child.stdin.on('error',()=>{});child.stdin.end(Buffer.from(value).toString('base64'));
  });
}
export async function loadWindowsGatewayKey(directory){
  await mkdir(directory,{recursive:true});const path=join(directory,'vault-gateway-key.dpapi');
  const info=await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if(info&&(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>16384))throw Error('GATEWAY_KEY_UNAVAILABLE');
  if(!info){const pair=generateKeyPairSync('ed25519');await writeFile(path,await dpapi('protect',pair.privateKey.export({type:'pkcs8',format:'pem'})),{flag:'wx',mode:0o600});}
  const privateKey=createPrivateKey(await dpapi('unprotect',await readFile(path))),publicKey=createPublicKey(privateKey).export({type:'spki',format:'pem'});
  await writeFile(join(directory,'vault-gateway-public.pem'),publicKey,{mode:0o600});
  return {privateKey,publicKey};
}
