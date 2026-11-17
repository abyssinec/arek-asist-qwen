import {Buffer} from 'node:buffer';
export const MODEL='qwen3.8-omni-flash-realtime';
export function sessionPayload(instructions,audio=false,tools=[]){return {modalities:audio?['text','audio']:['text'],instructions,tools,temperature:0.1,turn_detection:null,audio:{input:{format:{type:'pcm',sample_rate:16000,sample_format:'s16le',channels:1,packing:'interleaved',channel_layout:'mono'}},output:{voice:'Tina',format:{type:'pcm',sample_rate:24000}}}};}
export function speechMatches(a,b){const clean=s=>s.normalize('NFKC').toLowerCase().replaceAll('ё','е').replace(/[^\p{L}\p{N}]/gu,'');return clean(a)===clean(b);}
export function wav(pcm){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(24000,24);h.writeUInt32LE(48000,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
