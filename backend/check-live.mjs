import {writeFileSync} from 'node:fs';
const base=process.env.TEST_BASE||'http://127.0.0.1:5173/qwen-api';
const cases=[
 ['Сколько я должен за электроэнергию?','ru','open_account',null],
 ['Хочу подключить частный дом к электросети','ru','show_documents','connection-private-house'],
 ['Нужен перерасчёт','ru','show_documents','recalculation'],
 ['Как заключить договор?','ru','show_documents','contract-reissue'],
 ['Нужна пломбировка счётчика','ru','show_documents','meter-check'],
 ['Куда скинуть показания счетчика?','ru','get_company_answer',null],
 ['Көрсеткіштерді қалай беремін?','ru','get_company_answer',null],
 ['Power outage, who do I call?','kk','get_company_answer',null],
 ['Как испечь торт?','ru','guide_reply',null]
];
let fails=0,voice;
for(const [text,lang,expected,service] of cases){
 const res=await fetch(base+'/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,lang})});const data=await res.json();
 const pass=res.ok&&data.tool===expected&&(!service||data.actions.some(a=>a.type==='open_documents'&&a.serviceCode===service));if(!pass)fails++;
 console.log(JSON.stringify({text,status:res.status,tool:data.tool,actions:data.actions,replyLang:data.replyLang,pass}));
 if(text==='Нужен перерасчёт'&&!data.actions?.some(a=>a.type==='open_account'))fails++;
 if(text==='Куда скинуть показания счетчика?')voice=data;
}
if(voice){const res=await fetch(base+'/ai/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:voice.reply,lang:voice.replyLang,voiceToken:voice.voiceToken})});if(res.status===200){const wav=Buffer.from(await res.arrayBuffer());writeFileSync('.generated/verified-voice.wav',wav);console.log(JSON.stringify({voice:res.status,bytes:wav.length,sampleRate:wav.readUInt32LE(24)}));}else{console.log(JSON.stringify({voice:res.status}));fails++;}}
console.log(JSON.stringify({cases:cases.length,failures:fails}));if(fails)process.exitCode=1;
