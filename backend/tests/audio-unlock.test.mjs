import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['../frontend/src/voice/audio.ts','../frontend/src/voice/pcm.ts'],bundle:true,format:'esm',platform:'node',outdir:'.generated/unlock'});
const {playbackContext,unlockPlayback}=await import('../.generated/unlock/audio.js');
const {PcmPlayer}=await import('../.generated/unlock/pcm.js');
let gesture=false;
class Context {
 static instances=[];state='suspended';currentTime=0;destination={};sources=[];duringGesture=0;closed=false;
 constructor(){Context.instances.push(this);}
 resume(){if(gesture){this.duringGesture++;this.state='running';}return this.state==='running'?Promise.resolve():new Promise(()=>{});}
 async close(){this.state='closed';this.closed=true;}
 createBuffer(_channels,count,rate){const data=new Float32Array(count);return {duration:count/rate,getChannelData:()=>data};}
 createBufferSource(){const source={buffer:null,onended:null,connect(){},disconnect(){},start(){queueMicrotask(()=>source.onended?.());},stop(){}};this.sources.push(source);return source;}
}
test('Mic/keyboard gesture unlocks audio before STT/chat; delayed replies share the running context',async()=>{
 const old=globalThis.AudioContext;globalThis.AudioContext=Context;
 try{
  gesture=true;unlockPlayback();gesture=false;
  const context=playbackContext();assert.equal(context.state,'running');assert.equal(context.duringGesture,1);
  // Simulate several asynchronous recognition/chat stages after user activation has expired.
  await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));
  const first=new PcmPlayer(playbackContext());await first.play(new ReadableStream({start(c){c.enqueue(new Uint8Array([0,128,0,64]));c.close();}}));
  assert.equal(first.started,true);assert.equal(context.closed,false);
  const second=new PcmPlayer(playbackContext());await second.play(new ReadableStream({start(c){c.enqueue(new Uint8Array([0,0,0,64]));c.close();}}));
  assert.equal(second.started,true);assert.equal(Context.instances.length,1);assert.equal(context.state,'running');
  await context.close();
 }finally{gesture=false;globalThis.AudioContext=old;}
});
test('Blocked resume is cancelled immediately without waiting for the audio permission timeout',async()=>{
 const old=globalThis.AudioContext;globalThis.AudioContext=Context;
 try{
  const context=new Context(),player=new PcmPlayer(context),abort=new AbortController();let cancelled=false;
  const played=player.play(new ReadableStream({cancel(){cancelled=true;}}),abort.signal);
  await Promise.resolve();abort.abort();
  await assert.rejects(played,{name:'AbortError'});assert.equal(cancelled,true);assert.equal(context.closed,false);
 }finally{globalThis.AudioContext=old;}
});
test('Direct stop settles a pending resume and releases the reader',async()=>{
 const old=globalThis.AudioContext;globalThis.AudioContext=Context;
 try{
  const context=new Context(),player=new PcmPlayer(context);let cancelled=false;
  const played=player.play(new ReadableStream({cancel(){cancelled=true;}}));
  await Promise.resolve();player.stop();
  await assert.rejects(played,{name:'AbortError'});assert.equal(cancelled,true);
 }finally{globalThis.AudioContext=old;}
});
