import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
await build({absWorkingDir:root,entryPoints:['front-exports.ts'],bundle:true,format:'esm',platform:'node',outfile:'.generated/front.mjs',loader:{'.txt':'text','.csv':'text'}});
console.log('Kiosk knowledge and action contracts bundled.');
