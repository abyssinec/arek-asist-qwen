import {Buffer} from 'node:buffer';
import {MODEL,sessionPayload} from '../protocol.mjs';
export {MODEL,speechMatches,wav} from '../protocol.mjs';
export function configured(env){return /^sk-/.test(env.QWEN_API_KEY||'')&&/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(env.QWEN_WORKSPACE_ID||'')&&['ap-southeast-1','cn-beijing'].includes(env.QWEN_REGION||'ap-southeast-1');}
export async function runQwen(env,{instructions,text,pcm,audio=false,tools=[],signal,onAudio}){
 if(!configured(env))throw new Error('Qwen not configured');
 if(signal?.aborted)throw new Error('cancelled');
 const ctrl=new AbortController();
 let ws,settled=false,output='',bytes=0;const chunks=[],calls=new Map();
 let resolve,reject;const result=new Promise((a,b)=>{resolve=a;reject=b;});result.catch(()=>{});
 const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);ctrl.abort();try{ws?.close(1000,'turn complete');}catch{}error?reject(error):resolve(value);};
 const abort=()=>finish(new Error('cancelled'));
 const timer=setTimeout(()=>finish(new Error('Qwen timeout')),45000);signal?.addEventListener('abort',abort,{once:true});
 try{
  const response=await fetch('https://'+env.QWEN_WORKSPACE_ID+'.'+(env.QWEN_REGION||'ap-southeast-1')+'.maas.aliyuncs.com/api-ws/v1/realtime?model='+MODEL,{headers:{Upgrade:'websocket',Authorization:'Bearer '+env.QWEN_API_KEY},signal:ctrl.signal});
  ws=response.webSocket;if(!ws)throw new Error('Qwen upgrade rejected');
  if(settled){try{ws.close(1000,'cancelled');}catch{}return await result;}
  const send=e=>ws.send(JSON.stringify({event_id:crypto.randomUUID(),...e}));
  const collect=item=>{if(item?.type==='function_call')calls.set(item.call_id||item.id,{name:item.name,arguments:item.arguments,callId:item.call_id});};
  ws.addEventListener('message',event=>{if(settled)return;try{
   const e=JSON.parse(event.data);
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
   if(e.type==='error')throw new Error('Qwen provider error');
   if(e.type==='response.done'){
    for(const item of e.response?.output||[])collect(item);
    if(e.response?.status!=='completed')throw new Error('Qwen incomplete response');
    finish(null,{text:output,calls:[...calls.values()],pcm:Buffer.concat(chunks)});
   }
  }catch(error){finish(error);}});
  ws.addEventListener('close',()=>{if(!settled)finish(new Error('Qwen connection closed'));});
  ws.addEventListener('error',()=>finish(new Error('Qwen connection error')));
  ws.accept();
  return await result;
 }catch(error){finish(error);return await result;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);try{ws?.close(1000,'turn complete');}catch{}}
}
