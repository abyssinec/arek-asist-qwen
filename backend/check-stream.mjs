import {writeFileSync} from 'node:fs';
const base=process.env.TEST_BASE||'http://127.0.0.1:5173/qwen-api';
const cases=process.env.TEST_LANGUAGE?[process.env.TEST_LANGUAGE]:['ru','en','kk'];
for(const lang of cases){
 const text={ru:'Как передать показания счётчика?',en:'How do I submit my meter readings?',kk:'Көрсеткіштерді қалай беремін?'}[lang];
 const chatStart=performance.now();
 const chat=await fetch(base+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang})});
 const answer=await chat.json();if(!chat.ok)throw new Error('Chat failed');
 const chatMs=Math.round(performance.now()-chatStart),start=performance.now();
 const response=await fetch(base+'/ai/tts-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:answer.reply,lang:answer.replyLang,voiceToken:answer.voiceToken})});
 if(!response.ok||!response.headers.get('Content-Type')?.startsWith('audio/pcm'))throw new Error('No PCM stream');
 const reader=response.body.getReader();let firstMs,bytes=0,chunks=0;const pcm=[];
 while(true){const {done,value}=await reader.read();if(done)break;if(firstMs===undefined)firstMs=Math.round(performance.now()-start);bytes+=value.length;chunks++;pcm.push(value);}
 const endMs=Math.round(performance.now()-start);
 const result={lang,replyLang:answer.replyLang,chatMs,firstAudioMs:firstMs,streamEndMs:endMs,chunks,bytes,audioDurationSec:Math.round(bytes/48000*10)/10};
 console.log(JSON.stringify(result));
 if(!bytes||bytes%2||chunks<2||firstMs>=endMs)throw new Error('Audio was buffered');
 writeFileSync('.generated/stream-'+lang+'.pcm',Buffer.concat(pcm));
}
// Cancelling a live Node stream must also close the provider connection.
if(base.startsWith('http://127.0.0.1')){
 const chat=await fetch(base+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Как передать показания?',lang:'ru'})});const a=await chat.json();
 const r=await fetch(base+'/ai/tts-stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:a.reply,lang:a.replyLang,voiceToken:a.voiceToken})});const reader=r.body.getReader();await reader.read();await reader.cancel();
 await new Promise(resolve=>setTimeout(resolve,400));const health=await fetch(base+'/health').then(r=>r.json());
 console.log(JSON.stringify({cancelledStreamActiveSessions:health.activeSessions}));if(health.activeSessions!==undefined&&health.activeSessions!==0)throw new Error('Provider session leaked');
}
