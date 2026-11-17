import {Buffer} from 'node:buffer';
// Stateless signatures work across independent Pages isolates. Bind each receipt to its public answer and language for two minutes.
const key=secret=>crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function issueReceipt(secret,text,lang,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({text,lang,expires:now+120000,nonce:crypto.randomUUID()})).toString('base64url');
 const signature=await crypto.subtle.sign('HMAC',await key(secret),new TextEncoder().encode(payload));
 return payload+'.'+Buffer.from(signature).toString('base64url');
}
export async function verifyReceipt(secret,token,text,lang,now=Date.now()){
 if(typeof token!=='string'||token.length>40000)throw new Error('Invalid receipt');
 const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra!==undefined)throw new Error('Invalid receipt');
 const ok=await crypto.subtle.verify('HMAC',await key(secret),Buffer.from(signature,'base64url'),new TextEncoder().encode(payload));
 if(!ok)throw new Error('Invalid receipt');
 const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
 if(data.expires<=now||data.expires>now+120000||data.text!==text||data.lang!==lang)throw new Error('Invalid receipt');
 return data;
}
