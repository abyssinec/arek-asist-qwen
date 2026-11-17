import WebSocket from 'ws';
import {MODEL,sessionPayload} from './protocol.mjs';
export {MODEL,sessionPayload,speechMatches,wav} from './protocol.mjs';
const active=new Set();
export const activeSessions=()=>active.size;
// Same Yuki/GidAI Omni protocol: manual turns, Tina, PCM 16 kHz in / 24 kHz out.
export function runQwen(env,{instructions,text,pcm,audio=false,tools=[],signal,onAudio}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new Error('cancelled'));return;}
  const ws=new WebSocket(`wss://${env.QWEN_WORKSPACE_ID}.${env.QWEN_REGION||'ap-southeast-1'}.maas.aliyuncs.com/api-ws/v1/realtime?model=${MODEL}`,{headers:{Authorization:`Bearer ${env.QWEN_API_KEY}`}});
  active.add(ws);let settled=false,output='',bytes=0;const chunks=[],calls=new Map();
  const send=e=>ws.send(JSON.stringify({event_id:crypto.randomUUID(),...e}));
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error){active.delete(ws);ws.terminate();}else if(ws.readyState===WebSocket.OPEN)ws.close(1000,'turn complete');else ws.terminate();error?reject(error):resolve(result);};
  const abort=()=>finish(new Error('cancelled'));
  const timer=setTimeout(()=>finish(new Error('Qwen timeout')),45000);signal?.addEventListener('abort',abort,{once:true});
  const collect=item=>{if(item?.type==='function_call')calls.set(item.call_id||item.id,{name:item.name,arguments:item.arguments,callId:item.call_id});};
  ws.on('message',raw=>{if(settled)return;try{
   const e=JSON.parse(raw);
   if(e.type==='session.created'){const session=sessionPayload(instructions,audio,tools);session.audio.output.voice=env.QWEN_VOICE||'Tina';send({type:'session.update',session});}
   if(e.type==='session.updated'){
    if(pcm){for(let i=0;i<pcm.length;i+=6400)send({type:'input_audio_buffer.append',audio:pcm.subarray(i,i+6400).toString('base64')});send({type:'input_audio_buffer.commit'});}
    else{send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});send({type:'response.create'});}
   }
   if(e.type==='input_audio_buffer.committed'&&pcm)send({type:'response.create'});
   if(e.type===(audio?'response.audio_transcript.delta':'response.text.delta'))output+=e.delta||'';
   if(e.type==='response.audio_transcript.done'&&e.transcript)output=e.transcript;
   if(output.length>16000)throw new Error('Qwen response too large');
   if(e.type==='response.output_item.done')collect(e.item);
   if(e.type==='response.audio.delta'){bytes+=(e.delta||'').length;if(bytes>4000000)throw new Error('Qwen audio too large');const chunk=Buffer.from(e.delta,'base64');if(onAudio)onAudio(chunk);else chunks.push(chunk);}
   if(e.type==='error')throw new Error(`Qwen: ${e.error?.code||'provider error'}`);
   if(e.type==='response.done'){
    for(const item of e.response?.output||[])collect(item);
    if(e.response?.status!=='completed')throw new Error('Qwen incomplete response');
    finish(null,{text:output,calls:[...calls.values()],pcm:Buffer.concat(chunks)});
   }
  }catch(error){finish(error);}});
  ws.on('close',()=>{active.delete(ws);if(!settled)finish(new Error('Qwen connection closed'));});
  ws.on('error',()=>finish(new Error('Qwen connection error')));
 });
}
