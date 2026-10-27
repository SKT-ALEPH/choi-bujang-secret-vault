import {createServer} from 'node:http';
import {request} from 'node:http';
import {loadConfig,send} from './common.mjs';
const c=loadConfig('/config/runtime.json');
// This is the network entry for the existing vault UI, never a policy decision point.
createServer((req,res)=>{
  const upstream=request({hostname:c.aIp,port:8080,path:req.url,method:req.method,headers:{...req.headers,host:c.aIp+':8080'},timeout:25000},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
  upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>send(res,503,{error:'NETBIRD_GATEWAY_UNAVAILABLE'}));
  res.on('close',()=>upstream.destroy());req.pipe(upstream);
}).listen(8085,'0.0.0.0');
