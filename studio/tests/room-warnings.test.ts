// Предупреждения расстановки: «лифт» (корпус шире 900 в сборе) — только шкафам. Кухни из Базиса (параметрика m.kitchen и сырые
// кухонные модули) его не получают: ширины заданы проектом Базиса, в доке счётчик читался как ошибки (аудит 11.10.2026, A5).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,section,id,type Module} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject,parseProject,type Project} from '../src/project';
import {roomWarnings} from '../src/roomWarnings';
import type {RawSpec} from '../src/rawModule';

const LP='public/local-projects';
const has=(f:string)=>existsSync(`${LP}/${f}.json`);
const load=(f:string):Project=>parseProject(JSON.parse(readFileSync(`${LP}/${f}.json`,'utf8')));
const lifts=(p:Project)=>roomWarnings(p).filter(w=>w.kind==='logistics');
function rawModule(raw:RawSpec,w:number):Module{return {...initialModule(),name:'Сырой',width:w,height:720,depth:560,decor:'Белый',facadeDecor:'Слэйт',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw};}
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.room={...p.room,width:9000,depth:4000};p.modules=ms.map((m,i)=>({id:id(),x:i*1500,y:0,z:0,rotation:0,module:m}));return p;}

test('«лифт»: шкаф студии 1200 мм — одно предупреждение, 900 — ни одного',()=>{
  const p=newProject();p.room.width=4000;p.room.depth=4000;p.modules[0].module.width=1200;
  assert.equal(lifts(p).length,1);
  assert.match(lifts(p)[0].message,/1200 мм/);
  p.modules[0].module.width=900;assert.equal(lifts(p).length,0);
});

test('«лифт»: кухонному модулю студии (m.kitchen) и сырому кухонному модулю Базиса — не выдаётся, сырому шкафу Базиса — выдаётся',()=>{
  const base=kitchenBase({...initialModule(),sections:[section()]},1200);
  assert.ok(base.kitchen&&base.width===1200);
  assert.equal(lifts(project(base)).length,0,'параметрика кухни');
  const panels:RawSpec['panels']=[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]},{name:'Бок правый',kind:'ldsp',box:[1184,0,0,1200,720,560]}];
  assert.equal(lifts(project(rawModule({panels,hardware:[],source:'bazis-kitchen'},1200))).length,0,'сырой модуль кухни (source)');
  assert.equal(lifts(project(rawModule({panels,hardware:[],counts:{confirmats:4}},1200))).length,0,'сырой модуль кухни (ранний импорт со счётчиками)');
  assert.equal(lifts(project(rawModule({panels,hardware:[],row:true},1200))).length,0,'«Ряд»');
  assert.equal(lifts(project(rawModule({panels,hardware:[],source:'bazis-corpus'},1200))).length,1,'сырой шкаф Базиса — как шкаф');
  // остальные предупреждения кухонь (потолок, стены, окна) не затронуты: тот же модуль у стены глубже комнаты
  const p=project(base);p.room={...p.room,depth:500};
  assert.ok(roomWarnings(p).some(w=>w.kind?.startsWith('closed-wall')));
});

test('«лифт»: кухни k30 и k25 из Базиса — 0 предупреждений, сырой шкаф wardrobe-012 (2270 мм) — прежнее 1',{skip:!has('kitchen-k30')||!has('kitchen-k25')||!has('wardrobe-012')},()=>{
  for(const k of ['kitchen-k30','kitchen-k25']){
    const p=load(k);
    assert.ok(p.modules.some(a=>a.module.width>900),k+': есть модули шире 900');
    assert.deepEqual(lifts(p).map(w=>w.message),[],k);
  }
  const w=load('wardrobe-012');
  assert.equal(lifts(w).length,1);
});
