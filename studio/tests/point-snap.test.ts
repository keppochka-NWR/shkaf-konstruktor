// Решение Макса 29.10.2026 (ветка claude/snap-binds): Alt — точка на ближайшей линии, Ctrl — ближайшее пересечение двух линий,
// Shift — без привязки (раньше Alt). Геометрия в осях экрана вида.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject,type PlacedModule} from '../src/project';
import {candidateLines,viewLook,PLAN_LOOK,carcassCorners,type GuideLine} from '../src/guides';
import {altKeyupGuard,acrossSegments,ctrlDragStarts,wheelGuard,snapMode,isPointMode,toView,fromView,viewDelta,toSegments,closestOnSegment,nearestOnLine,segmentCross,nearestCross,pointSnap,snapDelta,snapAlong,nearestOutlineCorner,hitText,crossName,type Seg2} from '../src/pointSnap';

const seg=(h0:number,v0:number,h1:number,v1:number,what='л'):Seg2=>({a:{h:h0,v:v0},b:{h:h1,v:v1},what});

test('модификаторы: Ctrl — пересечение, Alt — на линию, Shift — без привязки, без клавиш — обычные привязки',()=>{
  assert.equal(snapMode({}),'snap');
  assert.equal(snapMode({shiftKey:true}),'free');
  assert.equal(snapMode({altKey:true}),'line');
  assert.equal(snapMode({ctrlKey:true}),'cross');
  assert.equal(snapMode({metaKey:true}),'cross','Cmd на Mac — как Ctrl');
  assert.equal(snapMode({ctrlKey:true,altKey:true}),'cross','Ctrl старше Alt');
  assert.equal(snapMode({altKey:true,shiftKey:true}),'line','Alt старше Shift');
  assert.ok(isPointMode('line')&&isPointMode('cross')&&!isPointMode('free')&&!isPointMode('snap'));
});

test('критик 29.10 (блокер): отпускание Alt гасится всегда — и после того, как отпустили мышь; другие клавиши — нет',()=>{
  assert.equal(altKeyupGuard({key:'Alt',target:null}),true);
  assert.equal(altKeyupGuard({key:'Control',target:null}),false);
  assert.equal(altKeyupGuard({key:'q',target:null}),false);
});

test('ближайшая точка на линии: перпендикуляр, у концов — конец отрезка; допуск',()=>{
  const s=seg(0,0,1000,0);
  assert.deepEqual(closestOnSegment({h:400,v:30},s),{h:400,v:0});
  assert.deepEqual(closestOnSegment({h:-50,v:10},s),{h:0,v:0});
  assert.deepEqual(closestOnSegment({h:1200,v:10},s),{h:1000,v:0});
  const hit=nearestOnLine({h:400,v:12},[s,seg(0,40,1000,40,'вторая')],20)!;
  assert.deepEqual(hit.p,{h:400,v:0});assert.equal(hit.what,'л');assert.equal(hit.kind,'line');
  assert.equal(nearestOnLine({h:400,v:25},[s],20),undefined,'дальше допуска — нет');
  // косая линия: проекция по перпендикуляру
  const d=nearestOnLine({h:0,v:100},[seg(-1000,-1000,1000,1000)],100)!;
  assert.deepEqual(d.p,{h:50,v:50});
});

test('пересечение двух линий: крест, угол (концы продлеваются на допуск), параллельные — нет',()=>{
  assert.deepEqual(segmentCross(seg(0,0,100,0),seg(50,-50,50,50)),{h:50,v:0});
  assert.equal(segmentCross(seg(0,0,100,0),seg(0,10,100,10)),undefined,'параллельные');
  assert.equal(segmentCross(seg(0,0,100,0),seg(150,-50,150,50)),undefined,'мимо конца');
  assert.deepEqual(segmentCross(seg(0,0,100,0),seg(105,-50,105,50),10),{h:105,v:0},'край упёрся рядом — продление на допуск');
  const hit=nearestCross({h:48,v:6},[seg(0,0,100,0,'пол'),seg(50,-50,50,50,'линия'),seg(0,30,100,30,'полка')],20)!;
  assert.deepEqual(hit.p,{h:50,v:0});assert.equal(hit.what,'пол × линия');assert.equal(hit.kind,'cross');
  assert.equal(nearestCross({h:48,v:6},[seg(0,0,100,0)],20),undefined,'одна линия — пересечения нет');
  assert.equal(nearestCross({h:80,v:6},[seg(0,0,100,0),seg(50,-50,50,50)],20),undefined,'пересечение дальше допуска');
  assert.equal(crossName('вспомогательная линия','вспомогательная линия'),'вспомогательные линии');
  assert.equal(crossName('стена','стена'),'угол помещения');
  assert.equal(crossName('край «Шкаф»','край «Шкаф»'),'угол: край «Шкаф»');
  // ближайшее из нескольких
  const two=nearestCross({h:95,v:3},[seg(0,0,200,0,'низ'),seg(50,-50,50,50,'a'),seg(100,-50,100,50,'b')],20)!;
  assert.deepEqual(two.p,{h:100,v:0});assert.equal(two.what,'низ × b');
});

test('pointSnap: snap/free — ничего; snapDelta — ход до точки, без попадания — как есть',()=>{
  const segs=[seg(0,0,1000,0,'пол'),seg(500,-500,500,500,'линия')];
  assert.equal(pointSnap('snap',{h:498,v:3},segs,20),undefined);
  assert.equal(pointSnap('free',{h:498,v:3},segs,20),undefined);
  const r=snapDelta('cross',{h:400,v:100},{h:95,v:-97},segs,20);
  assert.deepEqual(r.delta,{h:100,v:-100});assert.equal(r.hit?.what,'пол × линия');
  const l=snapDelta('line',{h:400,v:100},{h:20,v:-95},segs,20);
  assert.deepEqual(l.delta,{h:20,v:-100},'Alt: по высоте на пол, по ширине — как курсор');
  const none=snapDelta('cross',{h:0,v:0},{h:300,v:300},segs,20);
  assert.deepEqual(none.delta,{h:300,v:300});assert.equal(none.hit,undefined);
  assert.match(hitText(r.hit,'cross'),/Ctrl · пересечение: пол × линия/);
  assert.match(hitText(undefined,'line'),/рядом нет линии/);
  assert.equal(hitText(undefined,'free'),'Без привязки');
});

test('край «↔» ходит вдоль своей оси: добавка хода до линии/пересечения',()=>{
  const segs=[seg(700,-1000,700,3000,'линия'),seg(0,0,5000,0,'пол')];
  // край на h=690, тянется вправо; курсор на высоте 800
  assert.equal(snapAlong('line',{h:690,v:0},{h:1,v:0},{h:690,v:800},segs,20).shift,10);
  assert.equal(snapAlong('line',{h:650,v:0},{h:1,v:0},{h:650,v:800},segs,20).shift,0,'далеко — нет');
  const c=snapAlong('cross',{h:695,v:0},{h:1,v:0},{h:695,v:5},segs,20);
  assert.equal(c.shift,5);assert.equal(c.hit?.what,'линия × пол');
});

test('критик 29.10 п.2: ход по одной оси — линии, параллельные ходу, для Alt не в счёт (у пола не «прилипает» к полу)',()=>{
  const segs=[seg(0,0,5000,0,'пол'),seg(1600,0,1600,2000,'край'),seg(1584,0,1584,2000,'кромка')];
  assert.deepEqual(acrossSegments(segs,{h:1,v:0}).map(s=>s.what),['край','кромка']);
  assert.deepEqual(acrossSegments(segs,{h:0,v:1}).map(s=>s.what),['пол']);
  // край «↔» у пола: курсор на 4 мм выше пола, у края 1600 — ход до 1600, а не 0
  const r=snapAlong('line',{h:1608,v:0},{h:1,v:0},{h:1608,v:4},segs,20);
  assert.equal(r.hit?.what,'край');assert.equal(r.shift,-8);
  // линия Q (ход по нормали h): точка на ближайшей вертикали
  const q=pointSnap('line',{h:1608,v:4},acrossSegments(segs,{h:1,v:0}),20)!;
  assert.equal(q.p.h,1600);
});

test('критик 29.10 п.3: Alt — составляющая, которую линия не задаёт, до 1 мм; пойманная — точно',()=>{
  const r=snapDelta('line',{h:1000,v:0},{h:597.6,v:37.4},[seg(1600,-1000,1600,3000,'линия')],20);
  assert.deepEqual(r.delta,{h:600,v:37});assert.deepEqual(r.hit?.free,{h:false,v:true});
  const g=snapDelta('line',{h:1000,v:0},{h:12.6,v:247.2},[seg(0,250.5,4000,250.5,'линия')],20);
  assert.deepEqual(g.delta,{h:13,v:250.5});
  const c=snapDelta('cross',{h:1000,v:0},{h:597.6,v:248.4},[seg(1600,-1000,1600,3000),seg(0,250.5,4000,250.5)],20);
  assert.deepEqual(c.delta,{h:600,v:250.5},'пересечение — обе точно');
});

test('критик 29.10 п.4: Ctrl+щелчок с дрожанием 6 px — щелчок, перенос — от 9 px',()=>{
  assert.equal(ctrlDragStarts(6,0),false);assert.equal(ctrlDragStarts(4,4),false);
  assert.equal(ctrlDragStarts(9,0),true);assert.equal(ctrlDragStarts(7,7),true);
});

test('критик 29.10 п.5: Ctrl+колесо гасится только во время тяги',()=>{
  assert.equal(wheelGuard({ctrlKey:true,metaKey:false},true),true);
  assert.equal(wheelGuard({ctrlKey:false,metaKey:true},true),true);
  assert.equal(wheelGuard({ctrlKey:true,metaKey:false},false),false,'без тяги — масштаб страницы как обычно');
  assert.equal(wheelGuard({ctrlKey:false,metaKey:false},true),false,'колесо без Ctrl — как было');
});

test('оси вида: спереди/сверху/План — точка туда и обратно, глубина сохраняется',()=>{
  for(const look of [viewLook('front')!,viewLook('top')!,viewLook('side')!,viewLook('front',90)!,PLAN_LOOK]){
    const P={x:1234,y:567,z:890},q=toView(P,look),back=fromView(q,look,P);
    assert.ok(Math.abs(back.x-P.x)<1e-6&&Math.abs(back.y-P.y)<1e-6&&Math.abs(back.z-P.z)<1e-6,JSON.stringify(look));
  }
  // План: вправо +X, вверх — к задней стене (−Z)
  assert.deepEqual(toView({x:100,y:0,z:300},PLAN_LOOK),{h:100,v:-300});
  const d=viewDelta(10,20,PLAN_LOOK);assert.ok(d.x===10&&d.z===-20&&d.y===0);
});

test('линии вида спереди: углы корпуса и угол помещения — пересечения; край корпуса — точка на линии',()=>{
  const p=newProject();p.room={...p.room,width:4000,depth:3000,height:2700};
  const a:PlacedModule={id:'a',x:1000,y:0,z:0,rotation:0,module:{...initialModule(),name:'Шкаф',width:600,height:2000,depth:550}};
  const look=viewLook('front')!,lines:GuideLine[]=candidateLines([a],look,undefined,p.room,[]),segs=toSegments(lines,look);
  // верхний правый угол корпуса: h=1600, v=2000
  const c=nearestCross({h:1594,v:1993},segs,20)!;
  assert.deepEqual(c.p,{h:1600,v:2000});assert.match(c.what,/угол: край «Шкаф»/);
  // угол помещения пол × правая стена
  const w=nearestCross({h:3990,v:8},segs,20)!;assert.deepEqual(w.p,{h:4000,v:0});
  // край корпуса: точка на линии
  const l=nearestOnLine({h:1608,v:900},segs,20)!;assert.deepEqual(l.p,{h:1600,v:900});
  // опорный угол переноса — ближайший к месту захвата
  assert.deepEqual(nearestOutlineCorner(carcassCorners(a),look,{h:1100,v:1800}),{h:1000,v:2000});
  assert.deepEqual(nearestOutlineCorner(carcassCorners(a),look,{h:1500,v:100}),{h:1600,v:0});
});
