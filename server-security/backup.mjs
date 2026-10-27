import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
const key=privateKey=>createHash('sha256').update('keshev.audit.backup.v1\0').update(privateKey).digest();
export function sealBackup(bytes,privateKey){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(privateKey),iv);return Buffer.concat([Buffer.from('KSV1'),iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);}
export function openBackup(bytes,privateKey){if(bytes.subarray(0,4).toString()!=='KSV1')throw Error('BACKUP_FORMAT_REJECTED');const d=createDecipheriv('aes-256-gcm',key(privateKey),bytes.subarray(4,16));d.setAuthTag(bytes.subarray(-16));return Buffer.concat([d.update(bytes.subarray(16,-16)),d.final()]);}
export function saveBackup(store,privateKey){
  store.db.exec('PRAGMA wal_checkpoint(FULL)');const file='/backup/server-b.sqlite.enc';
  writeFileSync(file+'.tmp',sealBackup(readFileSync('/state/server-b.sqlite'),privateKey),{mode:0o600});renameSync(file+'.tmp',file);
  if(existsSync('/backup/server-b.sqlite'))unlinkSync('/backup/server-b.sqlite');
}
