import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {vernissageLayout} from '../src/facadesVernissage';
const root=process.argv[2];const require=createRequire(import.meta.url);
const M=require(root+'/studio-milling.js'),V=require(root+'/visuals.js');
const ctx:any={window:{}};vm.runInNewContext(readFileSync(root+'/catalog.js','utf8'),ctx);
const catalog=JSON.parse(JSON.stringify(ctx.window.FACADE_CATALOG));
let count=0;
for(const m of catalog.millings){for(const [w,h] of [[596,716],[300,1800],[1000,300]]){
 const got=M.drawing(String(m.id),w,h,19);
 assert(got,'Missing shared layout '+m.id);
 assert.deepEqual(got.layout,vernissageLayout({milling:String(m.id),cover:'film',thickness:19},w,h));
 assert(!/NaN|Infinity/.test(got.markup));count++;
}}
const normal=M.drawing('98',596,716,19),tall=M.drawing('98',300,1800,19);
assert.notEqual(normal.markup,tall.markup);
for(const [w,h] of [[596,716],[300,1800],[1000,300]]){
 const p={id:'check',name:'Фасад',family:'MDF',millingId:'98',filmId:catalog.films[0].id,w,h,t:19};
 const front=V.front(p,catalog,{}, {dimensions:false});
 assert(front.includes('data-milling="98"'));assert(front.includes('data-source="studio"'));assert(!front.includes('data-passport-sample'));
 assert(!V.back(p,catalog,{}).includes('data-milling="98"'));
}
console.log('PASS',count,'layouts exactly match Studio across all catalogue models and three aspect ratios; front/back separation');
