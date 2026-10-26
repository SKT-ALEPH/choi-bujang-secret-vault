import {createHash,generateKeyPairSync,createPrivateKey,createPublicKey,sign,verify,randomUUID} from 'node:crypto';
import {mkdir,lstat,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const fault=(code,status=409)=>Object.assign(Error(code),{code,status});
export const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const opaque=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{8,79}$/.test(value);
export function exact(value,keys){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
export async function body(req,max=32768){
 if(req.headers['content-type']?.split(';')[0]!=='application/json')throw fault('JSON_REQUIRED',415);
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw fault('REQUEST_TOO_LARGE',413);chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{throw fault('INVALID_JSON',400);}return {bytes,data};
}
const message=(method,path,time,nonce,bytes)=>`${method}\n${path}\n${time}\n${nonce}\n${sha(bytes)}`;
export function createSigner(privateKey){
 const key=createPrivateKey(privateKey),publicKey=createPublicKey(key).export({type:'spki',format:'pem'}),deviceId='device-'+sha(publicKey).slice(0,40);
 return {publicKey,deviceId,headers(path,bytes){const time=String(Date.now()),nonce=randomUUID();return {'x-keshev-time':time,'x-keshev-nonce':nonce,'x-keshev-signature':sign(null,Buffer.from(message('POST',path,time,nonce,bytes)),key).toString('base64')};}};
}
export function verifyRequest(publicKey,req,bytes,{clock=Date.now}={}){
 const time=req.headers['x-keshev-time'],nonce=req.headers['x-keshev-nonce'],signature=req.headers['x-keshev-signature'];
 if(typeof time!=='string'||!/^\d{13}$/.test(time)||Math.abs(clock()-Number(time))>30000||!uuid(nonce)||typeof signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(signature))throw fault('AGENT_SIGNATURE_REJECTED',403);
 if(!verify(null,Buffer.from(message(req.method,req.url,time,nonce,bytes)),publicKey,Buffer.from(signature,'base64')))throw fault('AGENT_SIGNATURE_REJECTED',403);
 return nonce;
}
export async function loadSigner(directory,encryption){
 await mkdir(directory,{recursive:true,mode:0o700});const path=join(directory,'agent-key.enc');
 let info=await lstat(path).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
 if(!info){const pair=generateKeyPairSync('ed25519'),text=pair.privateKey.export({type:'pkcs8',format:'pem'});await writeFile(path,await encryption.encrypt(text),{flag:'wx',mode:0o600});info=await lstat(path);}
 if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>16384||(info.mode&0o077)!==0)throw fault('AGENT_KEY_UNAVAILABLE');
 const signer=createSigner(await encryption.decrypt(await readFile(path)));
 await writeFile(join(directory,'agent-public.pem'),signer.publicKey,{mode:0o600});return signer;
}
