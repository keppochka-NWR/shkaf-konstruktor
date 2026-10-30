// Контур помещения произвольной формы — этап 1 (задача Макса 30.10.2026): стены и пол в 3D, «Ближние стены», проёмы и объекты на
// стенах контура, правила, привязки, выгрузка в Базис. Здесь — чистые функции (roomEdges.ts, roomCutaway.ts) и правила проекта.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,projectErrors,snapPlacement,appendModule,moduleFootprint,bounds,type Opening,type Project} from '../src/project';
import {outlinePreset,withOutline,rectOutline,flatten,polygonInOutline,outlineArea,edgeLength,legacyToEdge} from '../src/roomOutline';
import {openingEdge,edgeLegacyWall,edgePanels,wallPrism,wallFace,floorPolygon,edgeZone,outsideOutline,edgeToLegacy,edgeStations,wallSpot} from '../src/roomEdges';
import {hiddenEdges,outlineEdges,hiddenWalls,edgeVisible} from '../src/roomCutaway';
import {roomWarnings,openingZone} from '../src/roomWarnings';
import {validateFixture,newFixture} from '../src/fixtures';
import {candidateLines,PLAN_LOOK} from '../src/guides';
import {snapPlanes} from '../src/cornerStretch';
import {exportBazisConfig,bazisExportNote,BAZIS_OUTLINE_NOTE} from '../src/bazisRoom';
import {atWall} from '../src/freeSpot';

const shaped=(kind:'pentagon'|'chamfer'|'L'|'rounded'|'bay'):Project=>{const p=newProject();p.room=withOutline(p.room,outlinePreset(kind,4000,3000));return p;};
const names=(s:Set<number>)=>[...s].sort((a,b)=>a-b);
const win=(x:Partial<Opening>):Opening=>({id:'w',type:'window',wall:'front',offset:100,width:800,height:1200,sill:900,...x});

test('пятиугольник: скос — ребро 2 длиной 750√2, к передней стороне габарита',()=>{
  const o=shaped('pentagon').room.outline!;
  assert.equal(o.length,5);assert.ok(Math.abs(edgeLength(o,2)-750*Math.SQRT2)<0.01);
  assert.deepEqual(o.map((_,i)=>edgeLegacyWall(o,i)),['back','right','front','front','left']);
  assert.deepEqual(rectOutline(4000,3000).map((_,i)=>edgeLegacyWall(rectOutline(4000,3000),i)),['back','right','front','left']);
});

test('стена проёма: без контура — legacyToEdge, с edge — как есть, без edge — ближайшая к старому месту',()=>{
  const r=newProject().room;
  assert.deepEqual(openingEdge(r,win({wall:'front',offset:500,width:1200})),{...legacyToEdge(4000,3000,'front',500,1200),dir:-1});
  assert.deepEqual(openingEdge(r,win({wall:'back',offset:500,width:1200})),{edge:0,offset:500,dir:1});
  const p=shaped('pentagon');
  assert.deepEqual(openingEdge(p.room,win({edge:2,offset:120})),{edge:2,offset:120,dir:1});
  // старое окно на передней стене от левой 500 → передняя стена контура (ребро 3, идёт справа налево): отступ от правого конца 3250
  const e=openingEdge(p.room,win({wall:'front',offset:500,width:800}));
  assert.equal(e.edge,3);assert.equal(e.dir,-1);assert.ok(Math.abs(e.offset-(3250-500-800))<0.2);
});

test('куски стен контура: площадь стен = периметр × высота − проёмы, окно на скосе вырезано',()=>{
  const p=shaped('pentagon');p.room.openings=[win({edge:2,offset:100,width:800,height:1200,sill:900}),{id:'d',type:'door',wall:'back',edge:0,offset:300,width:800,height:2000,sill:0}];
  const panels=edgePanels(p.room as any),area=panels.reduce((s,q)=>s+(q.s1-q.s0)*(q.y1-q.y0),0);
  const perim=p.room.outline!.reduce((s,_,i)=>s+edgeLength(p.room.outline!,i),0);
  assert.ok(Math.abs(area-(perim*2700-800*1200-800*2000))<1);
  assert.ok(!panels.some(q=>q.edge===2&&q.s0<500&&q.s1>500&&q.y0<1500&&q.y1>1500),'на месте окна стены нет');
});

test('тело стены: прямая — 6 граней, внутренняя грань смотрит в комнату; дуга — ломаной',()=>{
  const o=shaped('pentagon').room.outline!,pos=wallPrism(o,{edge:2,s0:0,s1:edgeLength(o,2),y0:0,y1:2700},80);
  assert.equal(pos.length,6*2*3*3);
  const [ax,ay,az,bx,by,bz,cx,cy,cz]=pos,u=[bx-ax,by-ay,bz-az],v=[cx-ax,cy-ay,cz-az],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const inward=wallSpot(o,2,10).n;assert.ok(n[0]*inward.x+n[2]*inward.z>0,'нормаль внутренней грани — внутрь');
  const bay=shaped('bay').room.outline!,L=edgeLength(bay,0);
  assert.ok(edgeStations(bay,0,0,L).length>10);
  const face=wallFace(bay,{edge:0,s0:0,s1:L,y0:0,y1:2700});assert.equal(face.su.length/2,face.pos.length/3);
  assert.ok(Math.abs(face.su.at(-2)!-L)<1e-6||face.su.some(s=>Math.abs(s-L)<1e-6),'раскладка отделки — по длине дуги');
});

test('пол: многоугольник контура той же площади',()=>{
  for(const k of ['pentagon','chamfer','L','rounded','bay'] as const){const o=shaped(k).room.outline!;
    const pts=floorPolygon(o),a=pts.reduce((s,q,i)=>{const r=pts[(i+1)%pts.length];return s+q.x*r.z-r.x*q.z;},0)/2;
    assert.ok(Math.abs(a-outlineArea(o))<1,k);}
});

test('ближние стены пятиугольника: внутри — ничего, с переднего правого угла — правая, скос и передняя',()=>{
  const o=shaped('pentagon').room.outline!;
  assert.deepEqual(names(hiddenEdges(o,{x:2000,z:1500})),[]);
  assert.deepEqual(names(hiddenEdges(o,{x:6000,z:5000})),[1,2,3]);
  assert.deepEqual(names(hiddenEdges(o,{x:2000,z:-500})),[0]);
  assert.deepEqual(names(hiddenEdges(o,{x:-500,z:1500})),[4]);
  assert.deepEqual(names(hiddenEdges(o,{x:6000,z:5000},false)),[]);
  assert.deepEqual(names(hiddenEdges(o,{x:Number.NaN,z:5000})),[]);
  // прямоугольник по-старому
  assert.deepEqual([...hiddenWalls({width:4000,depth:3000},{x:6000,z:5000})].sort(),['front','right']);
});

test('ближние стены эркера: сбоку от дуги она видна, за её вершиной — скрыта; в эркере — ничего',()=>{
  const p=shaped('bay'),o=p.room.outline!;
  assert.equal(p.room.depth,3000,'эркер в прежнем габарите (критик 30.10)');
  assert.deepEqual(names(hiddenEdges(o,{x:-1000,z:1200})),[3]);
  assert.deepEqual(names(hiddenEdges(o,{x:2000,z:-100})),[0]);
  assert.deepEqual(names(hiddenEdges(o,{x:2000,z:500})),[]);
});

test('рёбра контура: низ и верх каждой стены — ей, угол — двум стенам; скрытая стена прячет свои рёбра',()=>{
  const o=shaped('pentagon').room.outline!,e=outlineEdges(o,2700);
  assert.equal(e.length,5*3);
  assert.equal(e.filter(x=>x.walls.length===2).length,5);
  const hidden=hiddenEdges(o,{x:6000,z:5000}),visible=e.filter(x=>edgeVisible(x.walls,hidden));
  assert.ok(visible.every(x=>!x.walls.some(w=>hidden.has(w))));
  assert.equal(outlineEdges(shaped('bay').room.outline!,2700).filter(x=>x.walls.length===1&&x.walls[0]===0).length>4,true,'дуга — ломаной');
});

test('правила проёмов на стене контура: номер стены, длина по стене, без наложения на одной стене',()=>{
  const p=shaped('pentagon');
  p.room.openings=[win({edge:2,offset:100,width:800})];assert.deepEqual(projectErrors(p),[]);
  p.room.openings=[win({edge:2,offset:300,width:800})];assert.match(projectErrors(p)[0],/за границы стены/);
  p.room.openings=[win({edge:7})];assert.match(projectErrors(p)[0],/не найдена/);
  p.room.openings=[win({id:'a',edge:0,offset:100}),win({id:'b',edge:0,offset:500})];assert.ok(projectErrors(p).some(e=>/пересекаться/.test(e)));
  // старое окно без edge на передней стене и окно на скосе — разные стены
  p.room.openings=[win({id:'a',edge:2,offset:0}),win({id:'b',wall:'front',offset:2000})];assert.deepEqual(projectErrors(p),[]);
  // дуга длиннее хорды: окно шире хорды эркера помещается
  const b=shaped('bay');b.modules[0].z=1100;b.room.openings=[win({wall:'back',edge:0,offset:0,width:4050})];assert.deepEqual(projectErrors(b),[]);
  // без контура edge не читается — старые правила
  const r=newProject();r.room.openings=[win({wall:'back',edge:9,offset:100})];assert.deepEqual(projectErrors(r),[]);
});

test('объект на стене контура: длина — по своей стене, номер стены проверяется',()=>{
  const p=shaped('pentagon'),s={...newFixture(p.room,'socket','front','s1'),edge:2,offset:100};
  assert.equal(validateFixture(p.room,s),null);
  assert.match(validateFixture(p.room,{...s,offset:1000})!,/длину стены \(1060\.7/);
  assert.match(validateFixture(p.room,{...s,edge:9})!,/не найдена/);
  assert.equal(validateFixture(newProject().room,{...s,edge:9,offset:100,wall:'back'}),null,'без контура — по wall');
});

test('зоны у стены контура: дверь на скосе — корпус перед ней предупреждён, дальний — нет; розетка на скосе за корпусом',()=>{
  const p=shaped('pentagon');p.room.openings=[{id:'d',type:'door',wall:'front',edge:2,offset:130,width:800,height:2000,sill:0}];
  const copy=structuredClone(p.modules[0]);copy.id='near';copy.x=2700;copy.z=1500;p.modules.push(copy);
  assert.deepEqual(projectErrors(p),[]);
  const w=roomWarnings(p).filter(x=>x.openingId==='d');
  assert.deepEqual([...new Set(w.map(x=>x.moduleId))],['near']);
  assert.ok(w.some(x=>x.kind==='opening-sweep'),'створка двери на скосе задевает корпус');
  // окно на дуге скруглённого угла (старое поле wall — 'back') не «открывается» в шкаф у задней стены слева
  const r=shaped('rounded');r.modules[0].x=1300;r.room.openings=[win({wall:'back',edge:1,offset:700,width:900,sill:850,height:1400})];
  assert.deepEqual(projectErrors(r),[]);assert.deepEqual(roomWarnings(r).filter(x=>x.openingId),[]);
  const z=openingZone(p.room,p.room.openings[0]);assert.ok(z.w>0&&z.d>0&&z.h===2000);
  // розетка на скосе у угла корпуса
  const q=shaped('pentagon'),m=structuredClone(q.modules[0]);m.id='m';m.x=2950;m.z=2062;q.modules=[m];
  q.room.fixtures=[{...newFixture(q.room,'socket','front','s'),edge:2,offset:580,width:80}];
  assert.deepEqual(projectErrors(q),[]);
  assert.ok(roomWarnings(q).some(x=>x.fixtureId==='s'&&x.moduleId==='m'));
});

test('выход за стены контура и зона — повёрнутые четырёхугольники',()=>{
  const o=shaped('pentagon').room.outline!;
  const out=outsideOutline(o,[{x:3900,z:2900},{x:100,z:100}]);
  assert.deepEqual([...out.keys()],[2]);assert.ok(Math.abs(out.get(2)!-(3900+2900-6250)/Math.SQRT2)<1);
  const z=edgeZone(o,2,0,100,0,900);assert.equal(z.length,4);assert.ok(Math.abs(z[3].x-(4000-900/Math.SQRT2))<0.01);
});

test('перетаскивание в скос: корпус упирается в стену, а не выходит за неё',()=>{
  const p=shaped('pentagon'),a=p.modules[0],poly=flatten(p.room.outline!);
  const next=snapPlacement(p,a.id,{x:3350,y:0,z:2350});
  assert.ok(polygonInOutline(moduleFootprint({...a,x:next.x,z:next.z}),poly),JSON.stringify(next));
  assert.ok(next.x>a.x&&next.z>a.z,'продвинулся к стене');
  // прямоугольник — как раньше: в углу габарита место есть, z — привязка к передней стене
  const r=newProject();assert.deepEqual(snapPlacement(r,r.modules[0].id,{x:3350,y:0,z:2350}),{x:3350,y:0,z:2382});
});

test('добавление: место в Г-образной комнате — не в вырезе',()=>{
  const p=shaped('L'),a=p.modules[0];a.x=1350;a.z=1700;
  assert.deepEqual(projectErrors(p),[]);
  const n=appendModule(p,a.module,a),added=n.modules.at(-1)!;
  assert.ok(polygonInOutline(moduleFootprint(added),flatten(p.room.outline!)),JSON.stringify(bounds(added)));
  assert.deepEqual(projectErrors(n).filter(e=>/границы/.test(e)),[]);
});

test('линии вида и привязки края: стены контура',()=>{
  const p=shaped('pentagon'),lines=candidateLines([],PLAN_LOOK,undefined,p.room).filter(l=>l.what==='стена');
  assert.equal(lines.length,5);
  assert.ok(lines.some(l=>Math.abs(Math.abs(l.n.x)-Math.SQRT1_2)<1e-3&&Math.abs(Math.abs(l.n.z)-Math.SQRT1_2)<1e-3),'скос — косая линия');
  const front=candidateLines([],{x:0,y:0,z:1},undefined,p.room);
  assert.deepEqual(front.map(l=>l.what).sort(),['пол','потолок','стена','стена'],'спереди — боковые стены с торца, пол и потолок');
  assert.ok(candidateLines([],PLAN_LOOK,undefined,shaped('bay').room).filter(l=>l.what==='дуга стены').length>4);
  const planes=snapPlanes(p,p.modules[0],'width').filter(s=>s.what==='стена').map(s=>s.at).sort((a,b)=>a-b);
  assert.deepEqual(planes,[0,3250,4000]);
  // прямоугольник — две стены по оси, как было
  const r=newProject();assert.deepEqual(snapPlanes(r,r.modules[0],'width').filter(s=>s.what==='стена').map(s=>s.at),[0,4000]);
});

test('у стены: задние углы у стены контура',()=>{
  const p=shaped('pentagon'),a=p.modules[0];
  assert.equal(atWall(p.room,a),true);
  assert.equal(atWall(p.room,{...a,z:1000}),false,'у левой стены, но не задом к стене');
  // задом к скосу: задний правый угол корпуса у скошенной стены (за ним в 150 мм — стена)
  const b=shaped('chamfer'),m=b.modules[0];m.x=2900;m.z=400;assert.deepEqual(projectErrors(b),[]);assert.equal(atWall(b.room,m),true);
});

test('Базис: контур не передаётся — габарит, проём со скоса — на сторону габарита, понятная пометка',()=>{
  const p=shaped('pentagon');p.room.openings=[win({edge:2,offset:100,width:800,windowSill:{width:1000,thick:40,overhang:60,offset:0}})];
  assert.equal(bazisExportNote(p.room),BAZIS_OUTLINE_NOTE);assert.equal(bazisExportNote(newProject().room),null);
  const xml=exportBazisConfig(p.room,'ТЕСТ');
  assert.match(xml,/ТЫЛЬНАЯ СТЕНА.*Окно/);assert.match(xml,/<Value>4000<\/Value>/);assert.doesNotMatch(xml,/outline|edge/);
  const l=edgeToLegacy(p.room as any,2,100,800);assert.equal(l.wall,'front');assert.ok(l.offset>=0&&l.offset<=3200);
});
