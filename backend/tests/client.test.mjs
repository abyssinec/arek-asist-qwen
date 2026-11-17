import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
await build({entryPoints:['../frontend/src/api/qwen.ts'],bundle:true,format:'esm',platform:'node',outfile:'.generated/client-test.mjs',define:{'import.meta.env':JSON.stringify({VITE_QWEN_ENABLED:'true',VITE_QWEN_API_URL:'/qwen-api'})}});
const {qwenAi,cancelQwen,toPcm}=await import('../.generated/client-test.mjs');
const originalFetch=globalThis.fetch;
test('AI adapter sends no history, validates cards and voices only the approved receipt language',async()=>{
 const calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return new Response(url.endsWith('/chat')?JSON.stringify({reply:'Approved answer',replyLang:'en',voiceToken:'receipt',actions:[{type:'open_account',title:'Open account'}]}):'audio',{status:200});};
 try{const r=await qwenAi.chat({text:'How much do I owe?',lang:'kk',sessionId:'session',kioskId:'kiosk',history:[{role:'user',text:'private old history'}]});assert.equal(r.actions[0].type,'open_account');assert.equal(calls[0].body.history,undefined);assert.equal(await qwenAi.tts('Invented answer','ru'),null);assert.ok(await qwenAi.tts(r.reply,'kk'));assert.equal(calls[1].body.lang,'en');assert.equal(calls[1].body.voiceToken,'receipt');assert.equal(await qwenAi.tts(r.reply,'en'),null);
 globalThis.fetch=async()=>Response.json({reply:'Invented',replyLang:'ru',voiceToken:'x',actions:[{type:'print',title:'Print'}]});await assert.rejects(qwenAi.chat({text:'question',lang:'ru',history:[],sessionId:'s',kioskId:'k'}));
 }finally{cancelQwen();globalThis.fetch=originalFetch;}
});
test('Session cancellation aborts an in-flight model request',async()=>{
 globalThis.fetch=(_url,opts)=>new Promise((_resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));
 try{const p=qwenAi.chat({text:'question',lang:'ru',history:[],sessionId:'s',kioskId:'k'});cancelQwen();await assert.rejects(p,{name:'AbortError'});}finally{globalThis.fetch=originalFetch;}
});
test('Microphone adapter keeps one-second 440 Hz audio when resampling 48 kHz to PCM 16 kHz',async()=>{
 const previous=globalThis.AudioContext;let closed=false;const rate=48000;const samples=Float32Array.from({length:rate},(_,i)=>0.5*Math.sin(2*Math.PI*440*i/rate));
 globalThis.AudioContext=class{async decodeAudioData(){return {length:rate,duration:1,sampleRate:rate,numberOfChannels:1,getChannelData:()=>samples};}async close(){closed=true;}};
 try{const pcm=Buffer.from(await toPcm(new Blob(['fixture'])),'base64');assert.equal(pcm.length,32000);let crossings=0,peak=0;for(let i=2;i<pcm.length;i+=2){const a=pcm.readInt16LE(i-2),b=pcm.readInt16LE(i);if(a<=0&&b>0)crossings++;peak=Math.max(peak,Math.abs(b));}assert.ok(Math.abs(crossings-440)<=1);assert.ok(peak>15000&&peak<17000);assert.equal(closed,true);}finally{globalThis.AudioContext=previous;}
});
