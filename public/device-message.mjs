export const enrollmentMessage=(id,challenge,tokenHash)=>JSON.stringify(['aleph.device.enroll.v1',id,challenge,tokenHash]);
export const requestMessage=({id,at,nonce,method,path,bodyHash,tokenHash})=>JSON.stringify([
  'aleph.device.request.v1',id,at,nonce,method,path,bodyHash,tokenHash]);
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
