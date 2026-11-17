import {readFileSync} from 'node:fs';
import {runQwen,speechMatches} from './qwen.mjs';
const env=Object.fromEntries(readFileSync('.env.local','utf8').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),JSON.parse(l.slice(i+1))];}));
const text='Как передать показания счётчика?';
const fixture=await runQwen(env,{instructions:'Read only this question verbatim, no other words: '+JSON.stringify(text),text:'Read the question.',audio:true});
if(!speechMatches(fixture.text,text))throw new Error('Invalid fixture');
const output=Buffer.alloc(Math.floor(fixture.pcm.length/3)*2);for(let i=0;i<output.length/2;i++){const p=i*1.5,a=Math.floor(p),f=p-a;output.writeInt16LE(Math.round(fixture.pcm.readInt16LE(a*2)*(1-f)+fixture.pcm.readInt16LE(Math.min(a+1,fixture.pcm.length/2-1)*2)*f),i*2);}
const base=process.env.TEST_BASE||'http://127.0.0.1:5173/qwen-api';
const r=await fetch(base+'/ai/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:output.toString('base64'),lang:'en'})});const result=await r.json();console.log(JSON.stringify({stage:'stt',status:r.status,...result}));
if(!r.ok||!result.text)process.exitCode=1;
else{const c=await fetch(base+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:result.text,lang:'en'})});const d=await c.json();console.log(JSON.stringify({stage:'chat',status:c.status,reply:d.reply,replyLang:d.replyLang,tool:d.tool,actions:d.actions}));if(!c.ok||d.replyLang!=='ru'||d.tool!=='get_company_answer')process.exitCode=1;}
