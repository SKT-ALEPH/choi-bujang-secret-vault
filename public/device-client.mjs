import {digest,enrollmentMessage,requestMessage} from './device-message.mjs';
const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/gu,'-').replace(/\//gu,'_').replace(/=+$/u,'');
let device=null;
async function sign(message){return encode(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},device.key,new TextEncoder().encode(message)));}
async function headers(session,path,options={}){
  if(!device)throw Error('기기 승인을 먼저 요청해 주세요.');
  const at=String(Date.now()),nonce=crypto.randomUUID(),method=options.method??'GET',body=options.body??'';
  const token='Bearer '+session.access_token;
  return{'x-aleph-device':device.id,'x-aleph-at':at,'x-aleph-nonce':nonce,
    'x-aleph-signature':await sign(requestMessage({id:device.id,at,nonce,method,path,
      bodyHash:await digest(body),tokenHash:await digest(token)}))};
}
async function call(session,operation,body,signed=false){
  const path='/api/device?operation='+operation,options=body===undefined?{}:{method:'POST',body:JSON.stringify(body)};
  const response=await fetch(path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,
    'Content-Type':'application/json',...(signed?await headers(session,path,options):{})}});
  const result=await response.json();if(!response.ok)throw Error('기기 확인에 실패했습니다. 다시 로그인하거나 승인을 요청해 주세요.');return result;
}
window.alephDevice={headers,clear(){device=null;},async approve(session){
  device=null;
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const pending=await call(session,'request',{publicKey:await crypto.subtle.exportKey('jwk',keys.publicKey)});
  device={id:pending.id,key:keys.privateKey};
  try{const proof=await sign(enrollmentMessage(pending.id,pending.challenge,await digest('Bearer '+session.access_token)));
    await call(session,'approve',{id:pending.id,signature:proof});
    return await this.status(session);
  }catch(error){device=null;throw error;}
},async status(session){if(!device)return false;return(await call(session,'status',undefined,true)).approved===true;},
async revoke(session){try{if(device)await call(session,'revoke',{},true);}finally{device=null;}}};
document.dispatchEvent(new Event('aleph-device-ready'));
