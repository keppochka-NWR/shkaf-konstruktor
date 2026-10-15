import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {mirrorKitchen} from '../src/kitchen';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {sideRecessOf} from '../scripts/kitchen/recognize-asym';
import {partCollisions} from '../src/collisions';
import {kitchenRearClearance} from '../src/kitchenAlignment';
import {place} from '../scripts/kitchen/buildKitchen';

// Пакет 4 (backlog F_ASYM_SIDES): боковины разной глубины — kitchen.sideRecess. Правило по базе: короткая боковина и всё между боковинами
// стоят от её задней кромки, длинная — во всю глубину, ХДФ набивной на короткой и в пазу длинной (k28 m16, k03 m03, k24 m01, k07 m01).
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const box=(p:{size:number[];position:number[]})=>p.position.map((v,i)=>[+(v-p.size[i]/2).toFixed(1),+(v+p.size[i]/2).toFixed(1)]);

test('sideRecess: k28 m16 из Базиса — PASS; левая короче на 203, ХДФ в пазу правой на 4; правило «от кромки» держит ширину и высоту; зеркало и parse',{skip:!has('k28')},()=>{
  const ref=load('k28','m16'),r=moduleFromEtalon(ref),m=r.module;
  assert.ok(honestPass(compareModule(ref,m),validate(m),r.unsupported));
  assert.deepEqual(m.kitchen!.sideRecess,{side:'left',back:203,groove:{into:4}});assert.equal(m.depth,560);
  const ps=parts(m),by=(id:string)=>ps.find(p=>p.id===id)!;
  assert.deepEqual(box(by('left'))[2],[203,560],'короткая боковина — от 203');assert.deepEqual(box(by('right'))[2],[0,560],'длинная — во всю глубину');
  assert.deepEqual(box(by('back'))[0],[1.5,478],'ХДФ: на короткой — накладной (1,5), в длинной — до дна паза (474 + 4)');
  assert.deepEqual(partCollisions(ps,m).filter(c=>!c.bazis).map(c=>c.names.join('×')),[]);
  for(const mm of [{...m,width:m.width+100},{...m,width:m.width-100},{...m,height:m.height+100}]){
    const q=parts(mm),b=q.find(p=>p.id==='back')!,rt=q.find(p=>p.id==='right')!;
    assert.deepEqual(validate(mm),[]);assert.deepEqual(box(rt)[2],[0,560]);
    assert.equal(+(b.position[0]+b.size[0]/2).toFixed(1),mm.width-16+4,'ХДФ в пазу длинной — от её внутренней пласти');
  }
  assert.equal(kitchenRearClearance(m),0,'ХДФ внутри габарита — сзади за длинной боковиной ничего нет (расстановка, границы помещения)');
  assert.equal(place(ref,m).z,(ref as unknown as {world:{origin:number[]}}).world.origin[2],'без сдвига на ХДФ');
  const a=structuredClone(m);mirrorKitchen(a);assert.equal(a.kitchen!.sideRecess!.side,'right');
  const pa=parseModule(JSON.parse(JSON.stringify(m)));assert.deepEqual(pa.kitchen!.sideRecess,m.kitchen!.sideRecess);
  const bad=structuredClone(m);bad.kitchen!.sideRecess!.back=500;assert.ok(validate(bad).some(e=>/Боковина короче сзади/.test(e)));
});

test('sideRecess: распознаётся только «ХДФ на короткой и в пазу длинной» (k03 m03 — да, с дном под короткой); иначе модуль не трогаем (k31 m02, k15 m07, k14 m01)',{skip:!has('k03')||!has('k31')||!has('k15')||!has('k14')},()=>{
  assert.deepEqual(sideRecessOf(load('k03','m03')),{side:'right',back:54,into:7});
  const r=moduleFromEtalon(load('k03','m03'));assert.equal(r.module.bottomUnder,true);
  const c=compareModule(load('k03','m03'),r.module);assert.deepEqual([c.missing.length,c.extra.length],[0,0],'детали как в Базисе');
  for(const [k,key] of [['k31','m02'],['k15','m07'],['k14','m01']] as const)assert.equal(sideRecessOf(load(k,key)),null,`${k} ${key}`);
});
