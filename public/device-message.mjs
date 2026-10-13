export const enrollmentMessage=(id,challenge,tokenHash)=>JSON.stringify(['aleph.device.enroll.v1',id,challenge,tokenHash]);
export function canonicalTarget(path){
  const url=new URL(path,'https://target.invalid');
  // Match the existing Vercel rewrites; aliases bind to one exact API resource.
  const item=/^\/(?:api\/)?(notes|announcements)\/([^/]+)$/u.exec(url.pathname)
    ?? /^\/api\/(restore)\/([^/]+)$/u.exec(url.pathname);
  if(item){url.pathname='/api/'+item[1];if(!url.searchParams.getAll('id').includes(item[2]))url.searchParams.append('id',item[2]);}
  else if(['/notes','/announcements','/my/notes'].includes(url.pathname))url.pathname='/api'+url.pathname;
  const ids=url.searchParams.getAll('id');
  if(ids.length>1&&ids.every(id=>id===ids[0])){url.searchParams.delete('id');url.searchParams.set('id',ids[0]);}
  url.searchParams.sort();return url.pathname+url.search;
}
export const requestMessage=({id,at,nonce,method,path,bodyHash,tokenHash})=>JSON.stringify([
  'aleph.device.request.v1',id,at,nonce,method,canonicalTarget(path),bodyHash,tokenHash]);
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
