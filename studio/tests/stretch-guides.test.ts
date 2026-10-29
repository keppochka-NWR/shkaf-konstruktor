// Решение Макса 29.10.2026 (ветка claude/stretch-guides): растяжение за угол как эластичная секция Базиса и вспомогательные линии Q.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject,parseProject,localToRoom,type PlacedModule,type Project} from '../src/project';
import {cornerDims,keepOpposite,snapAxis,widthPull,edgeOf,snapPlanes} from '../src/cornerStretch';
import {viewLook,viewAxes,candidateLines,placeGuide,parseTyped,makeGuide,guidesInView,snapOut,guidePlanes,snapMoveToGuides,parseGuides,carcassCorners,dot} from '../src/guides';
import {viewShortcut} from '../src/historyShortcuts';
import {planStretch} from '../src/rowResize';

const mod=(w=600,h=2000,d=550)=>({...initialModule(),name:'Шкаф',width:w,height:h,depth:d});
const at=(id:string,x:number,m=mod(),extra:Partial<PlacedModule>={}):PlacedModule=>({id,x,y:0,z:3,rotation:0,module:m,...extra});
function room(mods:PlacedModule[]):Project{const p=newProject();p.room={...p.room,width:5000,depth:3000,height:2700};p.modules=mods;return p;}

test('виды: спереди — ширина+высота, сверху — ширина+глубина, сбоку/слева — глубина+высота, 3D — нет',()=>{
  assert.deepEqual(cornerDims('front'),['width','height']);
  assert.deepEqual(cornerDims('top'),['width','depth']);
  assert.deepEqual(cornerDims('side'),['depth','height']);
  assert.deepEqual(cornerDims('left'),['depth','height']);
  assert.equal(cornerDims('iso'),null);
});

test('угол: противоположный край на месте — низ тянут, верх стоит; верх тянут — y тот же',()=>{
  const a=at('a',1000,mod(600,2000),{y:300});
  const top=keepOpposite(a,{...a.module,height:2100},{height:'hi'});
  assert.equal(top.y,300);assert.equal(top.module.height,2100);
  const bottom=keepOpposite(a,{...a.module,height:2100},{height:'lo'});
  assert.equal(bottom.y,200);assert.equal((bottom.y??0)+bottom.module.height,2300,'верх на месте');
});

test('угол сверху: фасад тянут — задняя стенка на месте; заднюю — фасад на месте; при любом повороте',()=>{
  for(const rotation of [0,90,180,270]){
    const a=at('a',1000,mod(600,2000,550),{rotation,z:500});
    const back0=localToRoom(a,0,0),front0=localToRoom(a,0,550);
    const f=keepOpposite(a,{...a.module,depth:650},{depth:'hi'}),fb=localToRoom(f,0,0);
    assert.ok(Math.abs(fb.x-back0.x)<.05&&Math.abs(fb.z-back0.z)<.05,`задняя на месте, поворот ${rotation}`);
    const b=keepOpposite(a,{...a.module,depth:650},{depth:'lo'}),bf=localToRoom(b,0,650);
    assert.ok(Math.abs(bf.x-front0.x)<.05&&Math.abs(bf.z-front0.z)<.05,`фасад на месте, поворот ${rotation}`);
  }
});

test('угол: ширина через правило ряда — левый угол тянут, правый край на месте (planStretch)',()=>{
  const p=room([at('a',1000)]),w=widthPull(p.modules[0],{end:'lo',raw:103},true,10);
  assert.deepEqual([w.side,w.raw,w.snap],['left',103,true]);
  const plan=planStretch(p,'a',w.side,w.raw,w.snap),n=plan.project!.modules[0];
  assert.equal(n.module.width,700);assert.equal(n.x+n.module.width,1600,'правый край на месте');
});

test('привязки высоты: потолок, потолок − зазор, край соседа; без привязки — шаг 10 мм, Alt — 1 мм',()=>{
  const p=room([at('a',1000,mod(600,2000)),at('b',1600,mod(600,2300))]),a=p.modules[0];
  assert.deepEqual(snapAxis(p,a,'height',{end:'hi',raw:296},true,10),{raw:300,size:2300,what:'край «Шкаф»'});
  assert.equal(snapAxis(p,a,'height',{end:'hi',raw:695},true,10).what,'потолок');
  assert.equal(snapAxis(p,a,'height',{end:'hi',raw:668},true,10).size,2670,'потолок − 30 мм');
  assert.equal(snapAxis(p,a,'height',{end:'hi',raw:144},true,10).size,2140);
  assert.equal(snapAxis(p,a,'height',{end:'hi',raw:144},false,10).size,2144);
  assert.ok(snapPlanes(p,a,'height').some(s=>s.what==='пол'));
});

test('вспомогательная линия: сторона по мыши, расстояние набранное или до мыши (1 мм)',()=>{
  const base={n:{x:1,y:0,z:0},at:1000};
  assert.deepEqual(placeGuide(base,{x:1300,y:0,z:0},600),{at:1600,dist:600,sign:1},'мышь справа — вправо');
  assert.deepEqual(placeGuide(base,{x:700,y:0,z:0},600),{at:400,dist:600,sign:-1},'мышь слева — влево');
  assert.equal(placeGuide(base,{x:1234.6,y:0,z:0}).at,1235);
  const up={n:{x:0,y:1,z:0},at:2000};
  assert.equal(placeGuide(up,{x:0,y:2100,z:0},450).at,2450,'выше — вверх');
  assert.equal(placeGuide(up,{x:0,y:1900,z:0},450).at,1550,'ниже — вниз');
  assert.equal(parseTyped('12,5'),12.5);assert.equal(parseTyped(''),undefined);assert.equal(parseTyped('.'),undefined);
});

test('виды и оси экрана: спереди — вправо +X, вверх +Y; сверху — вправо +X, вверх к задней стене',()=>{
  const f=viewLook('front')!;assert.deepEqual(f,{x:0,y:0,z:1});
  assert.deepEqual(viewAxes(f).h,{x:1,y:0,z:0});assert.deepEqual(viewAxes(f).v,{x:0,y:1,z:0});
  const t=viewLook('top')!;assert.deepEqual(viewAxes(t),{h:{x:1,y:0,z:0},v:{x:0,y:0,z:-1}});
  assert.equal(viewLook('iso'),null);
  const r=viewLook('front',90)!;assert.ok(Math.abs(r.x-1)<1e-9&&Math.abs(r.z)<1e-9,'поворот 90 — смотрим вдоль +X');
});

test('линии-кандидаты Q: контур корпуса, кромки деталей выбранного, пол/потолок/стены, поставленные линии',()=>{
  const p=room([at('a',1000,mod(600,2000))]),look=viewLook('front')!;
  const g=makeGuide('g1',look,{x:1,y:0,z:0},1600);
  const lines=candidateLines(p.modules,look,'a',p.room,[g]);
  assert.ok(lines.some(l=>l.what==='край «Шкаф»'&&l.n.x===1&&l.at===1000));
  assert.ok(lines.some(l=>l.what==='край «Шкаф»'&&l.n.y===1&&l.at===2000));
  assert.ok(lines.some(l=>l.what==='пол'&&l.at===0)&&lines.some(l=>l.what==='потолок'&&l.at===2700));
  assert.ok(lines.some(l=>l.what.startsWith('кромка')));
  assert.ok(lines.some(l=>l.guideId==='g1'));
  // линия видна только в своём виде
  assert.equal(guidesInView([g],viewLook('top')).length,0);assert.equal(guidesInView([g],look).length,1);
});

test('привязка к линии: край ширины, ход корпуса, высота угла',()=>{
  const p=room([at('a',1000)]),a=p.modules[0],look=viewLook('front')!;
  const g=makeGuide('g',look,{x:1,y:0,z:0},1600);
  const {E,o}=edgeOf(a,'width','hi');
  assert.deepEqual(snapOut(E,o,-3,guidePlanes([g]),10),{raw:0,what:'вспомогательная линия'});
  const w=widthPull(a,{end:'hi',raw:595},true,10,[makeGuide('h',look,{x:1,y:0,z:0},2200)]);
  assert.deepEqual([w.raw,w.snap],[600,false],'к линии — точно, без шага 10');
  const moved=snapMoveToGuides(a,{x:1395,y:0,z:3},{x:1395,y:0,z:3},[makeGuide('m',look,{x:1,y:0,z:0},2000)],10);
  assert.equal(moved.x,1400,'правый край корпуса на линии 2000');
  const hy=snapAxis(p,a,'height',{end:'hi',raw:395},true,10,[makeGuide('y',look,{x:0,y:1,z:0},2400)]);
  assert.equal(hy.size,2400);
  // Alt — без привязки к линиям
  assert.equal(snapAxis(p,a,'height',{end:'hi',raw:395},false,10,[makeGuide('y',look,{x:0,y:1,z:0},2400)]).size,2395);
});

test('линии в файле проекта: сохраняются, битые отбрасываются; не влияют на детали',()=>{
  const p=room([at('a',1000)]),look=viewLook('front')!;
  p.guides=[makeGuide('g1',look,{x:1,y:0,z:0},1600)];
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.guides,p.guides);
  assert.deepEqual(parseGuides([{id:'x',look:[0,0,1],n:[2,0,0],at:1},{id:'y',look:[0,0,1],n:[1,0,0],at:'a'},null]),[]);
  const plain=parseProject(JSON.parse(JSON.stringify({...p,guides:undefined})));
  assert.deepEqual(plain.modules,back.modules);
});

test('Q больше не 3D (решение Макса 29.10): 3D — E',()=>{
  const key=(code:string)=>({code,key:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,target:null}) as unknown as KeyboardEvent;
  assert.equal(viewShortcut(key('KeyQ')),null);assert.equal(viewShortcut(key('KeyE')),'iso');
});

test('углы корпуса — 8 точек габарита без фальшей',()=>{
  const a=at('a',1000,mod(600,2000,550),{y:100});const pts=carcassCorners(a);
  assert.equal(pts.length,8);assert.equal(Math.max(...pts.map(q=>dot(q,{x:0,y:1,z:0}))),2100);
});
