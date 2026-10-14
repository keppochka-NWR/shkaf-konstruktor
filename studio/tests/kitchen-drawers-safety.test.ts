import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate,type Module} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {parseProject} from '../src/project';
import {partCollisions} from '../src/collisions';
import {relayoutKDrawers,refitKDrawers,golaBand,kdHardwareSpan,withAxisH,type AxisDrawer,type KDrawer} from '../src/kitchenDrawers';
import {drawersSweep,applyChange,silentCollisions,isParametric,SWEEP_CHANGES} from '../scripts/kitchen/drawers-sweep';

// Ящики Базиса: конфликты с ящиками студии, глухие фасады, пересчёт по высоте с жёсткими полками и профилями Gola (аудит 11.10.2026, A4).
// Правило: модуль не сохраняется с пересечением, о котором проверка молчит. Фикстуры local-projects — только номера проектов и имена модулей.
const LP='public/local-projects';
const lp=(k:string)=>`${LP}/kitchen-${k}.json`;
const load=(k:string,i:number):Module=>parseProject(JSON.parse(readFileSync(lp(k),'utf8'))).modules[i].module;
const base=(n=3,system?:'axis-pro'|'firmax-ldsp'|'versalite-h45'|'start-sc')=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;m.kdrawers=relayoutKDrawers(m,n,undefined,system);return m;};
const drawerErrors=(m:Module)=>validate(m).filter(x=>/^Ящик|ящики студии/.test(x));
const clean=(m:Module)=>{assert.deepEqual(validate(m),[]);assert.deepEqual(silentCollisions(m),[]);};

test('kdrawers + sections.drawers: ящики студии и Базиса в одном модуле — ошибка проверки, а не 69 тихих пересечений',()=>{
  const m=base(3);clean(m);
  const both={...m,sections:[{...m.sections[0],drawers:1}]};
  assert.ok(validate(both).some(x=>/ящики студии не ставятся/.test(x)));
  assert.ok(partCollisions(parts(both),both).length>0,'пересечения есть — и проверка о них говорит');
});

test('глухой фасад (kitchen.blindFronts): фасад ящика поверх глухого — ошибка; раскладка вычитает глухой из колонки фасадов',()=>{
  const m=base(2);const ks=m.kdrawers as AxisDrawer[];
  const blind={...m,kitchen:{...m.kitchen!,blindFronts:[{y0:ks[0].y0,y1:ks[0].y0+200}]}};
  assert.ok(validate(blind).some(x=>/перекрывает глухой фасад 1/.test(x)));
  for(const n of [1,2,3]){
    const laid=relayoutKDrawers(blind,n);assert.equal(laid.length,n);
    assert.ok(laid.every(k=>k.y0>=ks[0].y0+200+3-0.01),`n=${n}: фасады выше глухого с зазором`);
    const fixed={...blind,kdrawers:laid};assert.deepEqual(drawerErrors(fixed).filter(x=>/глухой/.test(x)),[]);
  }
  // глухой над ящиками — колонка до его низа
  const top={...m,kitchen:{...m.kitchen!,blindFronts:[{y0:m.height-250,y1:m.height-1.5}]}};
  const laid=relayoutKDrawers(top,2);assert.ok(laid.every(k=>k.y1<=m.height-250-3+0.01));
});

test('профиль Gola: фурнитура ящика в профиле — ошибка «пересекает профиль Gola»; раскладка его обходит',()=>{
  const m=base(2);m.gola={cuts:[{top0:0,top1:57,depth:26,r:5},{top0:385,top1:442,depth:26,r:5}],faceTop:30};
  m.kdrawers=relayoutKDrawers(m,2);assert.deepEqual(drawerErrors(m),[]);
  const ks=m.kdrawers as AxisDrawer[];
  const bad={...m,kdrawers:[{...ks[0],runnerY:m.height-442-50},ks[1]] as KDrawer[]};
  assert.ok(validate(bad).some(x=>/Ящик 1: пересекает профиль Gola/.test(x)),validate(bad).join('; '));
  assert.ok(partCollisions(parts(bad),bad).some(c=>/Gola/.test(c.names.join(' '))),'и в деталях это пересечение');
});

test('жёсткая полка секции: раскладка обходит её как профиль Gola (band), фурнитура в полке — ошибка «пересекает жёсткую полку»',()=>{
  const m=base(2);m.sections[0].shelves=[0.5];m.sections[0].fixed=[0];m.sections[0].shelfDepth=100;
  const [lo,hi]=golaBand(m,m.kdrawers![0].y0,m.kdrawers![0].y1);assert.ok(Number.isFinite(hi)&&lo===-Infinity,'полка выше середины нижнего фасада — ограничивает верх');
  m.kdrawers=relayoutKDrawers(m,2);clean(m);
  const ks=m.kdrawers as AxisDrawer[],shelfY=116+0.5*(m.height-116);
  const bad={...m,kdrawers:[ks[0],{...ks[1],runnerY:shelfY+44-4}] as KDrawer[]};
  assert.ok(validate(bad).some(x=>/Ящик 2: пересекает жёсткую полку/.test(x)),validate(bad).join('; '));
  // полка мельче ящика по глубине (у задника 100, ящик 300 в глубине 560) — не препятствие
  const short={...bad,depth:560,kdrawers:[ks[0],{...ks[1],runnerY:shelfY+44-4,len:300 as const}] as KDrawer[]};
  assert.deepEqual(validate(short).filter(x=>/полку/.test(x)),[]);
});

test('внутренний ящик (inner) при смене высоты возвращается к своему фасаду, а не становится третьим фасадом; хозяин — под его направляющей',()=>{
  // как k25 «НМВарка»: хозяин — царга H-120, внутренний H-86 утоплен на 9 (front) с осью в 105 от верха фасада
  const m=base(2);const ks=m.kdrawers as AxisDrawer[];
  m.kdrawers=[ks[0],withAxisH(m,ks[1],120),{...ks[1],h:86 as const,inner:true as const,front:9,runnerY:Math.round((ks[1].y1-105)*10)/10}];
  clean(m);
  const n={...m,height:m.height+100};n.kdrawers=refitKDrawers(n,'height');
  const out=n.kdrawers as AxisDrawer[];
  assert.equal(out.length,3);assert.equal(out.filter(k=>k.inner).length,1,'внутренний остался внутренним');
  const inner=out.find(k=>k.inner)!,host=out[1];
  assert.equal(inner.y0,host.y0);assert.equal(inner.y1,host.y1);assert.equal(Math.round((host.y1-inner.runnerY)*10)/10,105,'отступ оси от верха фасада как был');
  assert.ok(kdHardwareSpan(host)![1]<=kdHardwareSpan(inner)![0]+0.01,'царга хозяина под направляющей внутреннего');
  clean(n);
});

test('local-projects: height+100 / depth+100 / width±100 по всем модулям с ящиками Базиса — ни одного тихого пересечения',{skip:!existsSync(LP)},()=>{
  const r=drawersSweep(LP,SWEEP_CHANGES,m=>!!m.kdrawers?.length);
  assert.ok(r.modules>=30,'модулей с ящиками Базиса в базе '+r.modules); // 35 на 14.10.2026
  assert.deepEqual(r.hits.map(h=>`${h.kitchen} «${h.name}» ${h.change}: ${h.first}`),[]);
});

test('local-projects: height+100 по всем 173 параметрическим модулям — тихих пересечений нет (были k15, k25, k27, k29, k31)',{skip:!existsSync(LP)},()=>{
  const r=drawersSweep(LP,['height+100']);
  assert.ok(r.modules>=170,String(r.modules));
  assert.deepEqual(r.hits.map(h=>`${h.kitchen} «${h.name}»: ${h.first}`),[]);
});

test('k29 «нМ 1» (глухой фасад под ящиками Axis): relayout n±1 и height+100 не кладут фасад на глухой, внутренний ящик на месте',{skip:!existsSync(lp('k29'))},()=>{
  const m=load('k29',2);const b=m.kitchen!.blindFronts![0];assert.ok(b);clean(m);
  for(const n of [1,2,3]){const laid=relayoutKDrawers(m,n);assert.ok(laid.every(k=>k.y0>=b.y1+3-0.01),`n=${n}`);assert.deepEqual(drawerErrors({...m,kdrawers:laid}).filter(x=>/глухой/.test(x)),[]);}
  const h=applyChange(m,'height+100');clean(h);
  assert.equal(h.kdrawers!.filter(k=>(k as AxisDrawer).inner).length,1);assert.ok(h.kdrawers!.every(k=>k.y0>=b.y1+3-0.01));
});

test('k25 «НМВарка», k31 «НМ 2», k15 «НМ 4»: height+100 — ящики обходят жёсткую полку и профиль Gola, проверка и детали чисты',{skip:!existsSync(lp('k25'))},()=>{
  for(const [k,i] of [['k25',4],['k31',15],['k15',3]] as const){
    if(!existsSync(lp(k)))continue;
    const m=load(k,i);assert.ok(isParametric(m)&&m.kdrawers?.length,`${k} #${i}`);clean(m);
    const h=applyChange(m,'height+100');
    assert.deepEqual(validate(h),[],`${k} «${m.name}»`);assert.deepEqual(silentCollisions(h),[],`${k} «${m.name}»`);
  }
});

test('k27 «НМ 2» (глухой фасад под профилем C, ящики СТАРТ над ним): height+100 — профиль C уходит вверх от глухого, ящику места нет — ошибка проверки, не тихое пересечение',{skip:!existsSync(lp('k27'))},()=>{
  // вырезы Gola заданы от верха боковины, глухой фасад — от пола: при росте корпуса между ними 100 мм, которых в Базисе не бывает;
  // раскладка в стопке не находит места под полкой и профилем — проверка называет профиль (раньше 11 тихих пересечений)
  const m=load('k27',1);clean(m);
  const h=applyChange(m,'height+100');
  assert.ok(validate(h).some(x=>/^Ящик 1: пересекает профиль Gola/.test(x)),validate(h).join('; '));
  assert.ok(silentCollisions(h).length>0,'пересечение есть — и проверка о нём говорит');
});

test('k05 m03 / k08 m04 (ящики внизу, жёсткая полка над ними): полка в band не меняет ящики Базиса при 0/+40/−30',{skip:!existsSync(lp('k05'))},()=>{
  for(const [k,i] of [['k05',2],['k08',3]] as const){
    if(!existsSync(lp(k)))continue;
    const m=load(k,i);if(!m.kdrawers?.length||!m.sections.some(s=>s.fixed?.length))continue;
    for(const dh of [0,40,-30]){const n={...m,height:m.height+dh};n.kdrawers=refitKDrawers(n,'height');assert.deepEqual(n.kdrawers,m.kdrawers,`${k} ${dh}`);}
  }
});
