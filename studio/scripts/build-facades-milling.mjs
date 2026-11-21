import {build} from 'esbuild';
const destination=process.argv[2];if(!destination)throw Error('Specify facade application path');
await build({entryPoints:['scripts/facades-milling-adapter.ts'],outfile:destination+'/studio-milling.js',bundle:true,format:'iife',globalName:'StudioMilling',platform:'browser',target:'es2022',minify:true,legalComments:'none',footer:{js:'if(typeof module==="object"&&module.exports)module.exports=StudioMilling;'}});
console.log('Compiled shared Studio milling geometry');
