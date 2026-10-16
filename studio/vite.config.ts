import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {publicStringsPlugin} from './scripts/public-build';
import {bakePricesPlugin} from './scripts/bake-prices';
const backupToken=randomUUID();
const localBackup={name:'local-project-backup',apply:'serve' as const,transformIndexHtml(){return [{tag:'meta',attrs:{name:'local-backup-token',content:backupToken},injectTo:'head' as const}];},configureServer(server:any){server.middlewares.use('/__local-project-backup',async(req:any,res:any)=>{
 if(req.method!=='POST'||req.headers['x-local-backup-token']!==backupToken){res.statusCode=403;res.end(JSON.stringify({error:'Обновите страницу перед резервным сохранением'}));return;}
 try{let raw='';for await(const c of req){raw+=c;if(raw.length>12000000)throw Error('Слишком большой проект');}const data=JSON.parse(raw);if(!Array.isArray(data.project?.modules)||!data.project?.room)throw Error('Нет проекта');
 const dir=resolve('reports/local-backups');await mkdir(dir,{recursive:true});const stem='kitchen-'+Date.now();await writeFile(resolve(dir,stem+'.project.json'),JSON.stringify(data.project,null,2));
 if(typeof data.image==='string'&&data.image.startsWith('data:image/png;base64,'))await writeFile(resolve(dir,stem+'.png'),Buffer.from(data.image.slice(22),'base64'));
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path:resolve(dir,stem+'.project.json')}));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({error:String(e)}));}
 });}};

// Публичная сборка (по умолчанию для `vite build`): только клиентские цены, без слов закупки и поставщиков в JS
// (src/buildMode.ts, scripts/public-build.ts). Менеджерская локальная сборка: STUDIO_MANAGER=1 — не публиковать.
const managerBuild=process.env.STUDIO_MANAGER==='1';
const publicLog:string[]=[];
const bakeLog:string[]=[];
const publicLogPlugin={name:'public-build-log',apply:'build' as const,async closeBundle(){if(managerBuild)return;await mkdir(resolve('test-results'),{recursive:true});await writeFile(resolve('test-results/public-build.txt'),publicLog.join('\n')+'\n');await writeFile(resolve('test-results/public-bake.txt'),bakeLog.join('\n')+'\n');}};

export default defineConfig(({command})=>({
  define: { __PUBLIC_BUILD__: JSON.stringify(command==='build'&&!managerBuild) },
  plugins: [react(),localBackup,...(command==='build'&&!managerBuild?[bakePricesPlugin(resolve('src'),bakeLog),publicStringsPlugin(publicLog),publicLogPlugin]:[])],
  base: "./",
  build: { outDir: "../web/studio", emptyOutDir: true },
  server: { port: 5173, proxy: {'/api': {target:'http://127.0.0.1:8115'}} },
}));
