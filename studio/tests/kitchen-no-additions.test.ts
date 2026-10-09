// Правило Макса 09.10.2026: в кухню из Базиса студия не добавляет ничего, чего нет в Базисе (детали, фурнитура, строки сметы).
// Аудит 34 кухонь — scripts/kitchen/audit-additions.ts. Шкафы студии — по-прежнему (регрессия правил шкафов).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,parts,type Module} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {newProject,parseProject,applyAutoFillers,fromBazis,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import type {RawSpec} from '../src/rawModule';

const led=(m:Module):Module=>{m.grooves=['left','right'].map(h=>({host:h,face:(h==='left'?'+':'-') as '+'|'-',along:[16,16] as [number,number],across:[100,117] as [number,number],depth:8,name:'паз под подсветку'}));return m;};
const k25wall=()=>{const m=led(kitchenWall(initialModule(),630));m.height=930;return m;};
const rawBody=():Module=>({...initialModule(),name:'Сырой',width:600,height:720,depth:560,decor:'Белый',facadeDecor:'Слэйт',sections:[section()],doors:false,backType:'none',plinthHeight:0,
  raw:{panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]},{name:'Бок',kind:'ldsp',box:[584,0,0,600,720,560]}],hardware:[],counts:{confirmats:8}} as RawSpec});
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=ms.map((m,i)=>({id:id(),x:200+i*1000,y:0,z:200,rotation:0,module:m}));return p;}
const ids=(p:Project)=>estimate(p).lines.map(l=>l.id);

test('кухня из Базиса (k25, навесной с пазом под подсветку): в смете нет подсветки, паз остаётся полосой в 3D',()=>{
  const p=project(k25wall());
  assert.ok(!ids(p).includes('light-stand'),'подсветки в Базисе нет — строки «Подсветка врезная в стойках» нет');
  assert.equal(estimate(p).retailExtras,0,'нет розничной надбавки за подсветку');
  const g=parts(p.modules[0].module).filter(d=>d.id.startsWith('groove:'));
  assert.equal(g.length,2,'пазы — тёмные полосы в 3D');
  assert.ok(g.every(d=>d.material==='metal'&&d.external),'полоса не в раскрое ЛДСП');
});

test('кухня из Базиса: в смете нет «Мелочёвки корпуса» и заглушек под конфирмат — у шкафа они остаются',()=>{
  const k=project(kitchenBase(initialModule(),600),k25wall()),e=ids(k);
  assert.ok(!e.includes('kit'),'норматив «Мелочёвка корпуса» — не из Базиса');
  assert.ok(!e.includes('confirmat-cap'),'заглушек под конфирмат в Базисе нет');
  assert.ok(e.includes('confirmat-7x50'),'конфирматы Базиса остаются');
  const w=newProject(),we=ids(w);
  assert.ok(we.includes('kit')&&we.includes('confirmat-cap')&&we.includes('confirmat'),'шкаф студии — как было');
});

test('сырой модуль Базиса: в смете нет «Мелочёвки корпуса» и заглушек под конфирмат',()=>{
  const e=estimate(project(rawBody()));
  assert.equal(e.lines.find(l=>l.id==='kit'),undefined);
  assert.equal(e.lines.find(l=>l.id==='confirmat-cap'),undefined);
  assert.equal(e.lines.find(l=>l.id==='confirmat-7x50')?.quantity,8,'конфирматы — по счётчику Базиса');
});

test('кухня из Базиса (k25 НММойка/НМВарка): в смете нет вырезов в столешнице, которых нет в Базисе',()=>{
  const row:RawSpec={row:true,panels:[{name:'Горизонтальная',kind:'other',box:[0,862,0,2600,900,600]}],hardware:[]};
  const p=project({...rawBody(),name:'Ряд',raw:row},{...rawBody(),name:'НММойка'},{...rawBody(),name:'НМВарка'}),e=ids(p);
  assert.ok(e.includes('worktop:raw:38'),'столешница Базиса — в смете');
  assert.ok(!e.includes('worktop-cut:sink')&&!e.includes('worktop-cut:hob'),'вырезов у столешниц Базиса нет');
});

test('кухня из Базиса (k19 «А 3»): откидной фасад на петлях без газлифта — в смете нет «Подъёмного механизма»',()=>{
  const m=kitchenWall(initialModule(),600);m.height=360;m.sections[0].doorHinges=['top'];
  const d=parts(m).find(x=>x.role==='door')!;assert.equal(d.hinge,'top');
  assert.ok(!ids(project(m)).includes('lift-mechanism'),'у Базиса на таком фасаде только петли');
  // шкаф студии с откидным фасадом — механизм по-прежнему требует подбора
  const w=newProject(),s=w.modules[0].module;s.sections=[section()];s.height=600;s.width=500;s.sections[0].doorHinges=['top'];
  assert.ok(ids(w).includes('lift-mechanism'));
});

test('кухня: «Работа цеха» — за листы ЛДСП, лист ХДФ работой не считается; шкаф — как было',()=>{
  const k=project(kitchenBase(initialModule(),600),kitchenWall(initialModule(),600)),plan=nest(k),e=estimate(k,plan);
  assert.ok(plan.some(s=>s.material==='hdf'),'в раскрое есть лист ХДФ');
  assert.equal(e.lines.find(l=>l.id==='work')!.quantity,plan.filter(s=>s.material!=='hdf').length);
  const w=newProject(),wp=nest(w);
  assert.equal(estimate(w,wp).lines.find(l=>l.id==='work')!.quantity,wp.length,'шкаф: правило не менялось');
});

test('кухня из Базиса: автофальши и сдвиги студии не добавляются; кухня студии и шкафы — по регламенту цеха',()=>{
  // два кухонных корпуса под 90° у стены — у кухни студии появится угловая фальш и сдвиг
  const mk=()=>{const p=project(kitchenBase(initialModule(),600),kitchenBase(initialModule(),600));p.room={...p.room,width:3000,depth:3000};
    p.modules[0]={...p.modules[0],x:0,z:0,rotation:0};p.modules[1]={...p.modules[1],x:0,z:600,rotation:90};return p;};
  const studio=applyAutoFillers(mk());
  assert.ok(studio.modules.some(a=>a.module.cornerFiller||a.module.wallFiller),'кухня студии: регламент фальшей как был');
  const b0=mk();b0.source='bazis';const b=applyAutoFillers(b0);
  assert.ok(fromBazis(b0));
  b.modules.forEach((a,i)=>{assert.equal(a.module.cornerFiller,undefined);assert.equal(a.module.wallFiller,undefined);assert.equal(a.x,b0.modules[i].x);assert.equal(a.z,b0.modules[i].z);});
  // ранний импорт без пометки — узнаётся по сырому модулю Базиса
  const r=mk();r.modules.push({id:id(),x:2000,y:0,z:2000,rotation:0,module:rawBody()});
  assert.ok(fromBazis(r));
  assert.ok(applyAutoFillers(r).modules.every(a=>!a.module.cornerFiller&&!a.module.wallFiller));
});

test('пометка «кухня из Базиса» сохраняется в файле проекта',()=>{
  const p=project(kitchenBase(initialModule(),600));p.source='bazis';
  assert.equal(parseProject(JSON.parse(JSON.stringify(p))).source,'bazis');
  assert.equal(parseProject(JSON.parse(JSON.stringify(newProject()))).source,undefined);
});
