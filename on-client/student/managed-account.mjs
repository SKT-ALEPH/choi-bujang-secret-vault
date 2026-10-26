// Normal Supabase email confirmation. No password storage, admin API or auto-confirm bypass.
export function createManagedAccount({transport}){
  let busy=false;
  return async function run({operation,email,tokenHash,type='email'}){
    if(busy)throw Object.assign(Error(),{code:'ACCOUNT_BUSY'});
    if(!['signup','login','verify'].includes(operation)||typeof email!=='string'||email.length>320||!/^\S+@\S+\.\S+$/.test(email)
      ||operation==='verify'&&(typeof tokenHash!=='string'||!/^[A-Za-z0-9_-]{20,256}$/.test(tokenHash)||!['email','signup','magiclink'].includes(type)))throw Object.assign(Error(),{code:'ACCOUNT_INPUT_INVALID'});
    busy=true;
    try{
      const body=operation==='verify'?{token_hash:tokenHash,type}:{email,create_user:operation==='signup',data:{}};
      return await transport('/agent/vault/relay',{method:'POST',path:operation==='verify'?'/api/auth?path=verify':'/api/auth?path=otp',headers:{'content-type':'application/json',authorization:'Bearer auth-via-server'},body:JSON.stringify(body)});
    }finally{busy=false;}
  };
}
