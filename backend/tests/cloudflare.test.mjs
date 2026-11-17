import test from 'node:test';
import assert from 'node:assert/strict';
import {issueReceipt,verifyReceipt} from '../cloudflare/receipt.mjs';
import worker from '../cloudflare/worker.mjs';
import {runQwen} from '../cloudflare/qwen.mjs';
const secret='test-only-key',now=Date.now();
test('Pages receipt survives another isolate, binds answer and language, rejects tampering and expiry',async()=>{
 const token=await issueReceipt(secret,'Здравствуйте!','ru',now);
 assert.equal((await verifyReceipt(secret,token,'Здравствуйте!','ru',now+1)).text,'Здравствуйте!');
 await assert.rejects(verifyReceipt(secret,token,'Другой текст','ru',now+1));
 await assert.rejects(verifyReceipt(secret,token,'Здравствуйте!','en',now+1));
 await assert.rejects(verifyReceipt('wrong key',token,'Здравствуйте!','ru',now+1));
 await assert.rejects(verifyReceipt(secret,token,'Здравствуйте!','ru',now+120000));
 const [p,s]=token.split('.');await assert.rejects(verifyReceipt(secret,p.slice(0,-1)+'A.'+s,'Здравствуйте!','ru',now+1));
});
test('Pages isolates API routes, origins and private files from static assets',async()=>{
 const env={ASSETS:{fetch:()=>new Response('static')},QWEN_API_KEY:'sk-test',QWEN_WORKSPACE_ID:'test'};
 const health=await worker.fetch(new Request('https://test.pages.dev/qwen-api/health'),env);
 assert.equal((await health.json()).records,149);
 const post=(path,origin)=>new Request('https://test.pages.dev'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await worker.fetch(post('/qwen-api/ai/chat','https://other.example'),env)).status,403);
 assert.equal((await worker.fetch(post('/qwen-api/unknown','https://test.pages.dev'),env)).status,404);
 assert.equal((await worker.fetch(post('/qwen-api/ai/tts','https://test.pages.dev'),env)).status,502);
 assert.equal((await worker.fetch(new Request('https://test.pages.dev/'),env)).status,200);
});
test('Workers Qwen session uses native function calls, closes after completion and on abort',async()=>{
 const original=globalThis.fetch;const sessions=[];
 class Socket extends EventTarget{
  sent=[];closed=false;
  accept(){queueMicrotask(()=>this.emit({type:'session.created'}));}
  emit(data){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}
  send(raw){const e=JSON.parse(raw);this.sent.push(e);if(e.type==='session.update')queueMicrotask(()=>this.emit({type:'session.updated'}));if(e.type==='response.create'&&!this.hang)queueMicrotask(()=>this.emit({type:'response.done',response:{status:'completed',output:[{type:'function_call',call_id:'native-1',name:'open_account',arguments:'{}'}]}}));}
  close(){this.closed=true;}
 }
 let hang=false;globalThis.fetch=async()=>{const s=new Socket();s.hang=hang;sessions.push(s);return {webSocket:s};};
 try{
  const env={QWEN_API_KEY:'sk-test',QWEN_WORKSPACE_ID:'test'};
  const first=await runQwen(env,{instructions:'test',text:'test',tools:[{type:'function',name:'open_account'}]});
  assert.equal(first.calls[0].callId,'native-1');assert.equal(sessions[0].closed,true);
  assert.equal(sessions[0].sent[0].session.audio.output.voice,'Tina');
  assert.equal(sessions[0].sent[0].session.input_audio_transcription,undefined);
  hang=true;const ctrl=new AbortController();const pending=runQwen(env,{instructions:'test',text:'test',signal:ctrl.signal});await new Promise(r=>setTimeout(r,5));ctrl.abort();
  await assert.rejects(pending,/cancelled/);assert.equal(sessions[1].closed,true);
 }finally{globalThis.fetch=original;}
});
