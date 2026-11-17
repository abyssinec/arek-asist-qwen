import test from 'node:test';import assert from 'node:assert/strict';
import {execute,candidates,tools,recordIds,languageOf} from '../kiosk.mjs';
import {scenarioResponse} from '../.generated/front.mjs';
import {speechMatches,wav,sessionPayload,MODEL} from '../qwen.mjs';
const call=(name,args)=>({name,arguments:JSON.stringify(args)});
for(const [code,text] of [['connection-private-house','подключение'],['meter-check','пломбировка'],['recalculation','перерасчет'],['contract-reissue','договор']])for(const lang of ['ru','kk','en'])test(`Preserve kiosk scenario ${code}/${lang}`,()=>{
 const result=execute(call('show_documents',{serviceCode:code}),lang,[]);
 assert.deepEqual(result,scenarioResponse({text,lang}));
 assert.equal(result.actions.find(a=>a.type==='open_documents').serviceCode,code);
 if(code==='recalculation')assert.ok(result.actions.some(a=>a.type==='open_account'));
});
test('Balance offers the existing account flow, without a made-up amount',()=>{const r=execute(call('open_account',{}),'ru',[]);assert.deepEqual(r.actions,[{type:'open_account',title:'Открыть лицевой счёт'}]);assert.match(r.reply,/введите ИИН/);assert.doesNotMatch(r.reply,/₸/);});
test('Only whitelisted functions, services, IDs and argument fields can execute',()=>{
 for(const c of [call('print',{}),call('show_documents',{serviceCode:'made-up'}),call('show_documents',{serviceCode:'meter-check',print:true}),call('open_account',{iin:'123456789012'}),call('guide_reply',{kind:'__proto__'}),call('get_company_answer',{recordId:'company/meter_readings',answer:'invented'})])assert.throws(()=>execute(c,'ru',[]));
 const records=candidates('Как передать показания?','ru');const id=records[0].id;
 const r=execute(call('get_company_answer',{recordId:id}),'ru',records);assert.ok(r.reply);assert.deepEqual(r.actions,[]);assert.equal(r.source,id);
 assert.throws(()=>execute(call('get_company_answer',{recordId:id}),'ru',[]));
});
test('149 namespace-safe entries and bounded native function schema',()=>{assert.equal(recordIds.length,149);assert.equal(new Set(recordIds).size,149);const c=candidates('Как передать показания?','ru');assert.ok(c.length<=12);const t=tools(c);assert.equal(t.length,4);assert.equal(t[0].parameters.additionalProperties,false);assert.deepEqual(t[0].parameters.properties.recordId.enum,c.map(x=>x.id));});
test('Question language overrides interface, uncertainty uses selected language',()=>{assert.equal(languageOf('Где главный офис?','en'),'ru');assert.equal(languageOf('How do I pay?','kk'),'en');assert.equal(languageOf('Көрсеткіштерді қалай беремін?','ru'),'kk');assert.equal(languageOf('???','kk'),'kk');});
test('Verified receipt rejects invented speech and WAV preserves provider PCM',()=>{
 assert.equal(speechMatches('Телефон: 576-580.','телефон 576 580'),true);assert.equal(speechMatches('Телефон 999.','Телефон 576-580.'),false);assert.equal(speechMatches('Ответ. Готово, деньги оплачены!','Ответ.'),false);
 const pcm=Buffer.from([0,0,255,127,0,128]);const w=wav(pcm);assert.equal(w.readUInt32LE(24),24000);assert.equal(w.readUInt16LE(22),1);assert.deepEqual(w.subarray(44),pcm);
 assert.equal(MODEL,'qwen3.8-omni-flash-realtime');assert.equal(sessionPayload('reader',true).audio.output.voice,'Tina');assert.equal(sessionPayload('reader',true).audio.input.format.sample_rate,16000);
});
