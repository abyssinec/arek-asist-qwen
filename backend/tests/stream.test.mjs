import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pcmResponse,voiceOptions} from '../voice.mjs';
import {issueReceipt} from '../cloudflare/receipt.mjs';
import worker from '../cloudflare/worker.mjs';
await Promise.all([
 build({entryPoints:['../frontend/src/voice/pcm.ts'],bundle:true,format:'esm',platform:'node',outfile:'.generated/pcm-test.mjs'}),
 build({entryPoints:['../frontend/src/api/qwen.ts'],bundle:true,format:'esm',platform:'node',outfile:'.generated/stream-client.mjs',define:{'import.meta.env':JSON.stringify({VITE_QWEN_ENABLED:'true',VITE_QWEN_API_URL:'/qwen-api'})}}),
 build({entryPoints:['../frontend/src/voice/tts.ts'],bundle:true,format:'esm',platform:'node',outfile:'.generated/tts-test.mjs',define:{'import.meta.env':JSON.stringify({VITE_QWEN_ENABLED:'true',VITE_TTS_ENABLED:'true'})},plugins:[{name:'test-ai',setup(b){b.onResolve({filter:/^\.\.\/api$/},()=>({path:'test-ai',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const api=globalThis.testVoiceApi;'}));}}]})
]);
const {PcmPlayer}=await import('../.generated/pcm-test.mjs');
const {qwenAi,cancelQwen}=await import('../.generated/stream-client.mjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('Server forwards the first PCM chunk before the only provider session completes',async()=>{
 let count=0,resolve,options;
 const provider=(_env,opt)=>{count++;options=opt;return new Promise(r=>{resolve=r;});};
 const {response,done}=pcmResponse({}, {text:'Approved',lang:'ru'},null,provider);
 const reader=response.body.getReader();options.onAudio(new Uint8Array([0,128]));
 assert.deepEqual((await reader.read()).value,new Uint8Array([0,128]));
 assert.equal(count,1);assert.equal(options.text,'Approved');
 assert.ok(options.instructions.length<220);
 resolve({text:'A different transcript',pcm:Buffer.alloc(0)});await done;
 assert.equal((await reader.read()).done,true);assert.equal(count,1);
});

test('Cancelling streamed response aborts the provider immediately',async()=>{
 let signal;
 const {response,done}=pcmResponse({}, {text:'Approved',lang:'en'},null,(_env,opt)=>{
  signal=opt.signal;return new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled'))));
 });
 await response.body.cancel();assert.equal(signal.aborted,true);await done;
});

test('Pages native PCM is emitted before response.done; transcript mismatch causes no retry',async()=>{
 const original=globalThis.fetch;let sockets=0,socket;
 class Socket extends EventTarget{
  closed=false;sent=[];
  emit(event){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(event)}));}
  accept(){queueMicrotask(()=>this.emit({type:'session.created'}));}
  close(){this.closed=true;}
  send(raw){const e=JSON.parse(raw);this.sent.push(e);if(e.type==='session.update')queueMicrotask(()=>this.emit({type:'session.updated'}));if(e.type==='response.create')queueMicrotask(()=>{this.emit({type:'response.audio_transcript.delta',delta:'different'});this.emit({type:'response.audio.delta',delta:'AIAAQA=='});});}
 }
 globalThis.fetch=async()=>{sockets++;socket=new Socket();return {webSocket:socket};};
 try{
  const env={QWEN_API_KEY:'sk-test',QWEN_WORKSPACE_ID:'test'};
  const token=await issueReceipt(env.QWEN_API_KEY,'Approved','ru');
  const request=new Request('https://test.pages.dev/qwen-api/ai/tts-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Approved',lang:'ru',voiceToken:token})});
  const pending=[];const response=await worker.fetch(request,env,{waitUntil:p=>pending.push(p)});
  assert.equal(response.headers.get('X-Audio-Sample-Rate'),'24000');
  const reader=response.body.getReader();const first=await reader.read();assert.deepEqual([...first.value],[0,128,0,64]);
  assert.equal(socket.closed,false);assert.equal(sockets,1);
  socket.emit({type:'response.done',response:{status:'completed',output:[]}});
  assert.equal((await reader.read()).done,true);await Promise.all(pending);
  assert.equal(socket.closed,true);assert.equal(sockets,1);
 }finally{globalThis.fetch=original;}
});

test('Client returns a live stream, keeps the answer language and cancels the HTTP body',async()=>{
 const original=globalThis.fetch;let controller,signal,lastBody,cancelled=false;
 globalThis.fetch=async(url,opts)=>{
  if(url.endsWith('/chat'))return Response.json({reply:'Approved',replyLang:'en',voiceToken:'token',actions:[]});
  signal=opts.signal;lastBody=JSON.parse(opts.body);
  return new Response(new ReadableStream({start(c){controller=c;},cancel(){cancelled=true;}}),{headers:{'Content-Type':'audio/pcm','X-Audio-Sample-Rate':'24000'}});
 };
 try{
  await qwenAi.chat({text:'Hello',lang:'kk',history:[],sessionId:'s',kioskId:'k'});
  const voice=await qwenAi.ttsStream('Approved','kk');assert.ok(voice);assert.equal(lastBody.lang,'en');
  controller.enqueue(new Uint8Array([0,128]));const reader=voice.getReader();assert.equal((await reader.read()).value.length,2);
  await reader.cancel();assert.equal(signal.aborted,true);assert.equal(cancelled,true);
  assert.equal(await qwenAi.ttsStream('Approved','en'),null);
 }finally{cancelQwen();globalThis.fetch=original;}
});

class Context {
 static instances=[];currentTime=0;destination={};sources=[];closed=false;
 constructor(){Context.instances.push(this);}
 async resume(){}
 async close(){this.closed=true;}
 createBuffer(_channels,count,rate){const values=new Float32Array(count);return {duration:count/rate,getChannelData:()=>values};}
 createBufferSource(){const source={buffer:null,onended:null,at:0,stopped:false,connect(){},disconnect(){},start(at){this.at=at;},stop(){this.stopped=true;}};this.sources.push(source);return source;}
}
test('Player starts before EOF and preserves samples across odd network chunks',async()=>{
 const previous=globalThis.AudioContext;globalThis.AudioContext=Context;let controller;
 try{
  const player=new PcmPlayer();const context=Context.instances.at(-1);
  const stream=new ReadableStream({start(c){controller=c;}});const played=player.play(stream);
  controller.enqueue(new Uint8Array([0,128,0]));await tick();
  assert.equal(player.started,true);assert.equal(context.sources[0].buffer.getChannelData(0)[0],-1);
  controller.enqueue(new Uint8Array([64]));await tick();
  assert.equal(context.sources[1].buffer.getChannelData(0)[0],0.5);
  assert.ok(Math.abs(context.sources[1].at-(context.sources[0].at+1/24000))<1e-8);
  controller.close();await tick();for(const source of context.sources)source.onended();await played;
  assert.equal(context.closed,true);
 }finally{globalThis.AudioContext=previous;}
});
test('Stopping playback cancels pending reads and releases all audio resources',async()=>{
 const previous=globalThis.AudioContext;globalThis.AudioContext=Context;let cancelled=false;
 try{
  const player=new PcmPlayer();const context=Context.instances.at(-1);
  const pending=player.play(new ReadableStream({cancel(){cancelled=true;}}));await tick();player.stop();await pending;
  assert.equal(cancelled,true);assert.equal(context.closed,true);
 }finally{globalThis.AudioContext=previous;}
});
test('Interrupted partial speech is never re-read by Blob TTS or browser fallback',async()=>{
 const previousContext=globalThis.AudioContext,previousWindow=globalThis.window;globalThis.AudioContext=Context;
 let fallback=0,blobs=0,controller;
 globalThis.window={speechSynthesis:{cancel(){},speak(){fallback++;}}};
 globalThis.testVoiceApi={ai:{tts:async()=>{blobs++;return null;},ttsStream:async()=>new ReadableStream({start(c){controller=c;}})}};
 try{
  const {speak}=await import('../.generated/tts-test.mjs');const pending=speak('Approved','ru');await tick();controller.enqueue(new Uint8Array([0,128]));await tick();
  controller.error(new Error('interrupted'));await pending;
  assert.equal(blobs,0);assert.equal(fallback,0);
 }finally{globalThis.AudioContext=previousContext;globalThis.window=previousWindow;delete globalThis.testVoiceApi;}
});
