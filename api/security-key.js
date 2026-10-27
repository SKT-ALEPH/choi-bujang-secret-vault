import {webEventPublicKey} from '../src/server-events.mjs';
export default function(req,res){res.setHeader('cache-control','no-store');if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});try{return res.status(200).json({schema:'keshev.web-key.v1',publicKey:webEventPublicKey()});}catch{return res.status(503).json({error:'KEY_UNAVAILABLE'});}}
