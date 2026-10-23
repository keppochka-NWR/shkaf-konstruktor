import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate,parts} from '../src/model';
import {kitchenTemplate,kitchenProject,kitchenItemOf} from '../src/kitchenProject';
import {applyAutoFillers,bounds,projectErrors,modulesOverlap,KITCHEN_TIGHT_CORNER,type Project,type PlacedModule} from '../src/project';
import {setWallDistance,rotateModule} from '../src/operations';
import {placeModuleAt,placeToWall,cornerTurns,continueAroundCorner,rowOf,wallDistances,WALL_ROTATION,type Wall} from '../src/wallPlacement';
import {createKitchenCornerRow,createKitchenURow,placeKitchenCorner,CORNER_CLEARANCE} from '../src/kitchenCornerRow';
import {cornerOf,reshapeCorner} from '../src/kitchenCorner';

// Постановка второго крыла Г-кухни (задача Макса 23.10.2026, замер тестера кухонь 22.10): атомарное положение, «к стене»,
// «за угол», палитра «Кухня угловая (Г)».
const src=initialModule();
const kitchenRoom=(mods:PlacedModule[],w=3600,d=3000):Project=>applyAutoFillers({version:3,kind:'kitchen',room:{width:w,depth:d,height:2700,openings:[]},modules:mods});
const put=(kind:Parameters<typeof kitchenTemplate>[0],width:number,x:number,z:number,rotation=0,y=0):PlacedModule=>({id:kind+'-'+width+'-'+x+'-'+z,x,y,z,rotation,module:kitchenTemplate(kind,width,src)});
const fixed=(p:Project)=>applyAutoFillers(p);
const inRoom=(p:Project)=>p.modules.every(a=>{const b=bounds(a);return b.x>=-0.1&&b.z>=-0.1&&b.x+b.w<=p.room.width+0.1&&b.z+b.d<=p.room.depth+0.1;});
const overlaps=(p:Project)=>{let n=0;p.modules.forEach((a,i)=>p.modules.slice(0,i).forEach(b=>{if(modulesOverlap(a,b))n++;}));return n;};

test('атомарная постановка: поворот 270 и X/Z одним изменением — без промежуточного отказа, который даёт поосевая правка',()=>{
  // ряд у задней стены 3000 и пенал, стоящий у задней стены справа: поворот на месте пересекается с рядом (как в k19 m11)
  const row=kitchenProject(3000);
  const tall:PlacedModule={id:'tall',x:3021,y:0,z:3,rotation:0,module:kitchenTemplate('tall',450,src)};
  const p=fixed({...row,room:{...row.room,width:3600},modules:[...row.modules.filter(a=>a.module.kitchen?.role!=='wall'),tall]});
  assert.deepEqual(projectErrors(p),[]);
  // поосевая правка тестера: поворот → «пересекается», X → «пересекается»/«за границы»
  assert.throws(()=>rotateModule(p,'tall',270),/пересекается|границ/);
  // цель: у правой стены, от задней стены 700 (за рядом)
  const tb=bounds({...tall,rotation:270,x:0,z:0});
  const n=placeModuleAt(p,'tall',{rotation:270,x:3600-tb.w,z:700});
  const a=n.modules.find(x=>x.id==='tall')!;
  assert.equal(a.rotation,270);
  const d=wallDistances(n,a);
  assert.equal(d.right,0);assert.equal(d.z,700);
  assert.deepEqual(projectErrors(n),[]);
  // итог занят — отказ один, по итогу (а не на промежуточном шаге)
  assert.throws(()=>placeModuleAt(p,'tall',{rotation:270,x:2500,z:100}),/пересекается/);
  // угол впритык (пенал вплотную к концу ряда у стены): по умолчанию — наша версия с планкой (решение Макса 23.10): места под планку
  // нет — отказ; правило KITCHEN_TIGHT_CORNER 'butt' (как в Базисе) — стык без планки
  assert.equal(KITCHEN_TIGHT_CORNER.mode,'plank');
  assert.throws(()=>placeModuleAt(p,'tall',{rotation:270,right:0,z:0}),/пересекается/);
  KITCHEN_TIGHT_CORNER.mode='butt';
  try{assert.deepEqual(projectErrors(placeModuleAt(p,'tall',{rotation:270,right:0,z:0})),[]);}finally{KITCHEN_TIGHT_CORNER.mode='plank';}
});

test('атомарная постановка: введённый отступ — итоговый с автофальшью у стены (габарит монтажа)',()=>{
  const p=fixed(kitchenRoom([put('base-drawers',600,500,3)]));
  const n=placeModuleAt(p,'base-drawers-600-500-3',{x:0,z:0});
  const a=n.modules[0];
  assert.equal(wallDistances(n,a).x,0);
  // тот же результат, что старый «От левой стены»
  const old=setWallDistance(setWallDistance(p,a.id,'x',0),a.id,'z',0);
  assert.equal(Math.round(bounds(old.modules[0]).x),Math.round(bounds(a).x));
});

for(const wall of ['back','left','right','front'] as Wall[])for(const from of [0,90,180,270])
  test(`«Поставить к стене»: к ${wall} из поворота ${from}° — фасадом в комнату, спиной вплотную, внутри комнаты`,()=>{
    const a=put('base-doors',600,1500,1200,from);
    const p=fixed(kitchenRoom([a]));
    const n=placeToWall(p,a.id,wall);
    const b=n.modules.find(x=>x.id===a.id)!,d=wallDistances(n,b);
    assert.equal(b.rotation,WALL_ROTATION[wall]);
    assert.equal(({back:d.z,left:d.x,right:d.right,front:d.front})[wall],0);
    assert.ok(inRoom(n));
    assert.deepEqual(projectErrors(n),[]);
  });

test('«Поставить к стене»: ближайшее свободное место у стены — мимо занятого, вплотную к соседу',()=>{
  const row=kitchenProject(3000);
  const mod=put('base-drawers',600,1500,1800,0);
  const p=fixed({...row,room:{...row.room,width:4200},modules:[...row.modules,mod]});
  const n=placeToWall(p,mod.id,'back');
  const a=n.modules.find(x=>x.id===mod.id)!;
  assert.equal(a.rotation,0);
  assert.equal(wallDistances(n,a).z,0);
  // у задней стены занято 21…3021 — встаёт вплотную справа от ряда
  assert.ok(Math.abs(bounds(a).x-3021)<=22,String(bounds(a).x));
  assert.deepEqual(projectErrors(n),[]);
});

test('«Продолжить ряд за угол»: крайний правый модуль ряда у задней стены → правая стена сразу за глубиной ряда',()=>{
  // ряд 3000 от левой стены до правой (21 + 3000 + 21): за углом место только за глубиной ряда
  const row=kitchenProject(3000);
  const p=fixed({...row,room:{...row.room,width:3042}});
  assert.deepEqual(projectErrors(p),[]);
  const bases=p.modules.filter(a=>a.module.kitchen?.role==='base').sort((a,b)=>a.x-b.x),last=bases.at(-1)!;
  const turns=cornerTurns(p,last.id);
  assert.deepEqual(turns.map(t=>t.wall),['right']);
  assert.ok(!cornerTurns(p,bases[1].id).length,'средний модуль ряда — не крайний');
  const r=continueAroundCorner(p,turns[0],{module:kitchenTemplate('base-drawers',600,src)});
  const a=r.project.modules.find(x=>x.id===r.id)!,d=wallDistances(r.project,a);
  assert.equal(a.rotation,270);assert.equal(d.right,0);
  const depth=Math.max(...rowOf(p,last.id).map(x=>bounds(x).z+bounds(x).d));
  assert.ok(bounds(a).z>=depth-0.1&&bounds(a).z<=depth+40,`за глубиной ряда ${depth}: ${bounds(a).z}`);
  assert.deepEqual(projectErrors(fixed(r.project)),[]);
  // с учётом угловой планки: модуль крыла — с планкой у задней стороны, корпус за ней
  assert.equal(a.module.cornerKind,'plank');
  // навесной ряд — за угол на правую стену от глубины навесных
  const walls=p.modules.filter(a=>a.module.kitchen?.role==='wall').sort((a,b)=>a.x-b.x),wl=walls.at(-1)!;
  const wt=cornerTurns(p,wl.id);
  const w=continueAroundCorner(p,wt[0],{module:kitchenTemplate('wall',600,src),y:wl.y});
  const wa=w.project.modules.find(x=>x.id===w.id)!;
  assert.equal(wa.rotation,270);assert.equal(wa.y,wl.y);
  assert.deepEqual(projectErrors(fixed(w.project)),[]);
});

for(const wing of ['right','left'] as const)
  test(`«Кухня угловая (Г)» 3000×2400, крыло ${wing}: 0 пересечений, столешница 2 куска, угловой стыкуется, всё в комнате`,()=>{
    const room={width:3600,depth:3000,height:2700};
    const group=createKitchenCornerRow(src,{back:3000,side:2400,wing,room});
    const p=fixed({version:3,kind:'kitchen',room:{...room,openings:[]},modules:group});
    assert.deepEqual(projectErrors(p),[]);
    assert.equal(overlaps(p),0);
    assert.ok(inRoom(p));
    const tops=p.modules.filter(a=>a.module.worktop);
    assert.equal(tops.length,2);
    // угловой: глухая часть в угол, дверь кончается до плоскости фасадов крыла на CORNER_CLEARANCE
    const corner=p.modules.find(a=>cornerOf(a.module))!,c=cornerOf(corner.module)!;
    assert.equal(c.side,wing);
    const cb=bounds(corner),R=room.width;
    const wingBases=p.modules.filter(a=>a.module.kitchen?.role==='base'&&(a.rotation??0)!==0);
    assert.ok(wingBases.length>=2);
    const facePlane=wing==='right'?Math.min(...wingBases.map(a=>bounds(a).x)):Math.max(...wingBases.map(a=>bounds(a).x+bounds(a).w));
    const doorEdge=wing==='right'?cb.x+c.door+c.inset:cb.x+cb.w-c.door-c.inset;
    assert.ok(Math.abs(Math.abs(facePlane-doorEdge)-CORNER_CLEARANCE)<=2,`дверь ${doorEdge}, фасады крыла ${facePlane}`);
    assert.ok(wing==='right'?doorEdge<facePlane:doorEdge>facePlane);
    // крыло начинается от линии фасадов первого ряда; у первого модуля крыла — угловая планка (наша версия, решение Макса 23.10)
    const firstWing=wingBases.sort((a,b)=>bounds(a).z-bounds(b).z)[0];
    assert.equal(Math.round(bounds(firstWing).z),Math.round(cb.z+cb.d));
    assert.equal(firstWing.module.cornerKind,'plank');
    assert.ok(!corner.module.cornerFiller,'у углового фальш — его глухая часть');
    assert.ok(Math.abs(wing==='right'?R-cb.x-cb.w:cb.x)>=0);
    // навесные по обоим крыльям; над нижним угловым — навесной угловой (глухая часть в угол, до боковой стены), первый навесной крыла — с планкой
    const walls=p.modules.filter(a=>a.module.kitchen?.role==='wall');
    assert.ok(walls.some(a=>(a.rotation??0)===0)&&walls.some(a=>(a.rotation??0)!==0));
    const wc=walls.find(a=>cornerOf(a.module)?.wall)!,wcb=bounds(wc);
    assert.ok(wc,'навесной угловой');
    assert.equal(cornerOf(wc.module)!.side,wing);
    assert.equal(Math.round(wing==='right'?R-wcb.x-wcb.w:wcb.x),0,'навесной угловой — до боковой стены');
    assert.ok(Math.abs(wcb.x-(wing==='right'?cb.x:0))<1,'навесной угловой — над нижним угловым');
    const wingWalls=walls.filter(a=>(a.rotation??0)!==0).sort((a,b)=>bounds(a).z-bounds(b).z);
    assert.equal(Math.round(bounds(wingWalls[0]).z),Math.round(wcb.z+wcb.d));
    assert.equal(wingWalls[0].module.cornerKind,'plank');
    // автофальши ничего не сдвигают: раскладка уже с планками
    group.forEach((a,i)=>{assert.ok(Math.abs(p.modules[i].x-a.x)<0.01&&Math.abs(p.modules[i].z-a.z)<0.01,a.module.name);});
    // мойка одна
    assert.equal(p.modules.filter(a=>a.module.kitchen?.appliance==='sink').length,1);
  });

test('«Кухня угловая (Г)»: «Заменить кухню» ставит Г вместо прямого ряда; слишком длинный ряд — понятная ошибка',()=>{
  const p=kitchenProject(3000);
  const r=placeKitchenCorner(p,src,{back:3000,side:2400,wing:'right'},true);
  assert.deepEqual(projectErrors(applyAutoFillers(r.project)),[]);
  assert.equal(r.project.modules.filter(a=>a.module.worktop).length,2);
  assert.throws(()=>placeKitchenCorner(p,src,{back:4000,side:2400,wing:'right'},true),/длиннее стены/);
  assert.throws(()=>placeKitchenCorner(p,src,{back:3000,side:600,wing:'right'},true),/правой стене/);
});

test('«Кухня П-образная» 3600 (левая 2400, правая 2000): 0 пересечений, столешница 3 куска, два нижних и два навесных угловых',()=>{
  const room={width:3600,depth:3000,height:2700};
  const group=createKitchenURow(src,{left:2400,back:3600,right:2000,room});
  const p=fixed({version:3,kind:'kitchen',room:{...room,openings:[]},modules:group});
  assert.deepEqual(projectErrors(p),[]);
  assert.equal(overlaps(p),0);
  assert.ok(inRoom(p));
  assert.equal(p.modules.filter(a=>a.module.worktop).length,3);
  const corners=p.modules.filter(a=>cornerOf(a.module));
  assert.deepEqual(corners.filter(a=>!cornerOf(a.module)!.wall).map(a=>cornerOf(a.module)!.side).sort(),['left','right']);
  assert.deepEqual(corners.filter(a=>cornerOf(a.module)!.wall).map(a=>cornerOf(a.module)!.side).sort(),['left','right']);
  assert.equal(p.modules.filter(a=>a.module.kitchen?.appliance==='sink').length,1);
  assert.ok(p.modules.some(a=>a.rotation===90)&&p.modules.some(a=>a.rotation===270));
  // «Заменить» в проекте кухни; задняя не во всю ширину — понятная ошибка
  const r=placeKitchenCorner(kitchenProject(3000),src,{left:2400,back:3600,right:2000,u:true},true);
  assert.deepEqual(projectErrors(applyAutoFillers(r.project)),[]);
  assert.throws(()=>createKitchenURow(src,{left:2400,back:3000,right:2000,room}),/ширина комнаты/);
});

test('навесной угловой из палитры: глухая часть справа/слева, «Угловой ›» меняет сторону, дверь и фальш тем же генератором',()=>{
  const m=kitchenTemplate('wall-corner',1000,src,{side:'left'});
  assert.deepEqual(validate(m),[]);
  const c=cornerOf(m)!;
  assert.equal(c.wall,true);assert.equal(c.side,'left');assert.equal(c.filler,m.depth);assert.equal(c.strip,59);
  assert.equal(kitchenItemOf(m),'wall-corner');
  const r=reshapeCorner(m,{side:'right'});assert.equal(cornerOf(r)!.side,'right');assert.deepEqual(validate(r),[]);
  const f=reshapeCorner(m,{filler:400});assert.equal(cornerOf(f)!.filler,400);assert.equal(cornerOf(f)!.door,Math.round((1000-400-59)*10)/10);assert.deepEqual(validate(f),[]);
  assert.throws(()=>reshapeCorner(m,{door:100}),/дверь от 250/);
  assert.ok(parts(m).some(p=>p.id==='face-filler:panel:facade')&&parts(m).some(p=>p.id==='face-filler:strip:facade'));
});
