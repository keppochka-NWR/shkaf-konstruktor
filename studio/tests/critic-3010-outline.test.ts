// Критик 30.10 по контуру помещения (задача Макса 30.10.2026): 3D, правила, выгрузка в Базис, правка формы. Каждый пункт — регрессия.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,projectErrors,appendModule,bounds,moduleFootprint,closedModuleBounds,closedModuleCorners,keepInRoom,overlap,type Opening,type Project} from '../src/project';
import {outlinePreset,withOutline,rectOutline,chamferCorner,setBulge,edgeLength,flatten,polygonInOutline,cornerEdgeMap,type RoomOutline} from '../src/roomOutline';
import {openingEdge,outsideOutline,sillCenter,edgeZone,pointsBox} from '../src/roomEdges';
import {roomWarnings} from '../src/roomWarnings';
import {openingSweepPoint} from '../src/environmentChecks';
import {hiddenEdges} from '../src/roomCutaway';
import {newFixture,validateFixture,fixtureBox,type Fixture} from '../src/fixtures';
import {exportBazisConfig,importBazisConfig,bazisExportNote,BAZIS_OUTLINE_NOTE} from '../src/bazisRoom';
import {applyOutline,itemEdge,offWalls} from '../src/roomShape';
import {candidateLines,PLAN_LOOK} from '../src/guides';
import {toSegments} from '../src/pointSnap';

const shaped=(o:RoomOutline):Project=>{const p=newProject();p.room=withOutline(p.room,o);return p;};
const preset=(k:'chamfer'|'L'|'pentagon'|'bay')=>shaped(outlinePreset(k,4000,3000));
const win=(x:Partial<Opening>):Opening=>({id:'w',type:'window',wall:'front',offset:100,width:800,height:1200,sill:900,...x});

/** Корпус под углом rot задом вплотную (0,5 мм) к стене edge, серединой на s мм от её начала. */
function flush(p:Project,edge:number,s:number,rot:number){
  const a={...p.modules[0],x:0,z:0,rotation:rot},f=moduleFootprint(a),mid={x:(f[0].x+f[1].x)/2,z:(f[0].z+f[1].z)/2};
  const ol=p.room.outline!,A=ol[edge],B=ol[(edge+1)%ol.length],L=Math.hypot(B.x-A.x,B.z-A.z),t={x:(B.x-A.x)/L,z:(B.z-A.z)/L},n={x:-t.z,z:t.x};
  const target={x:A.x+t.x*s+n.x*0.5,z:A.z+t.z*s+n.z*0.5};
  p.modules[0]={...a,x:target.x-mid.x,z:target.z-mid.z};return p.modules[0];
}

test('п.1: корпус под 45° вплотную к скосу — без «выступает за плоскость стены», батарея рядом — без ложного перекрытия',()=>{
  const p=preset('chamfer'),a=flush(p,1,530,315);
  assert.deepEqual(projectErrors(p),[]);
  // габарит по осям выходил бы за скос на сотни мм — сценарий тот самый
  const b=closedModuleBounds(a);assert.ok(Math.max(...outsideOutline(p.room.outline!,[{x:b.x,z:b.z},{x:b.x+b.w,z:b.z},{x:b.x+b.w,z:b.z+b.d},{x:b.x,z:b.z+b.d}]).values())>200);
  assert.deepEqual(roomWarnings(p).filter(w=>w.kind?.startsWith('closed-wall')),[]);
  assert.equal(outsideOutline(p.room.outline!,closedModuleCorners(a)).size,0);
  // батарея на правой стене у скоса: в габарит по осям попадает, в повёрнутый корпус — нет
  p.room.fixtures=[{...newFixture(p.room,'radiator','right','r',2),offset:150,width:800,depth:200}];
  assert.deepEqual(projectErrors(p),[]);
  const z=edgeZone(p.room.outline!,2,150,950,0,200),zb=pointsBox(z);
  assert.ok(overlap({...b},{...zb,y:150,h:600}),'габарит по осям задевал бы зону батареи');
  assert.deepEqual(roomWarnings(p).filter(w=>w.fixtureId==='r'),[]);
  // прямоугольник — по-старому: корпус за передней стеной предупреждён
  const r=newProject();r.modules[0].z=3000-621+5;assert.ok(roomWarnings(r).some(w=>w.kind==='closed-wall-передней')||projectErrors(r).length>0);
});

test('п.2: старый объект/проём без edge в комнате с контуром — по длине своей стены контура; новый объект — по стене контура',()=>{
  const p=preset('L');
  const plinth:Fixture={...newFixture(newProject().room,'floorPlinth','front','pl')};assert.equal(plinth.width,4000);
  assert.match(validateFixture(p.room,plinth)!,/длину стены \(2000/,'плинтус 4000 на стене 2000 — ошибка, а не свисает');
  const made=newFixture(p.room,'floorPlinth','front','pl2');
  assert.equal(made.edge,openingEdge(p.room,{wall:'front',offset:2000,width:0}).edge);assert.equal(made.width,Math.floor(edgeLength(p.room.outline!,made.edge!)));assert.equal(made.offset,0);
  assert.equal(validateFixture(p.room,made),null);
  const sock=newFixture(p.room,'socket','back','s',1);assert.equal(sock.edge,1);assert.equal(sock.width,80);assert.equal(validateFixture(p.room,sock),null);
  // окно 2100 на передней стороне Г-комнаты (передние стены по 2000) — ошибка; 1800 — помещается
  p.room.openings=[win({wall:'front',offset:1000,width:2100})];assert.match(projectErrors(p)[0],/Проём 1/);
  p.room.openings=[win({wall:'front',offset:2100,width:1800})];assert.deepEqual(projectErrors(p),[]);
  // габарит объекта (мойка, сифон) — у его стены контура
  const f={...newFixture(p.room,'pipe','front','pp',2),offset:500,width:40,depth:40};
  const fb=fixtureBox(p.room,f);assert.ok(Math.abs(fb.z+fb.d-1500)<1&&fb.x>3000,JSON.stringify(fb));
  // без контура — как было
  assert.deepEqual(newFixture(newProject().room,'socket','back','x'),{id:'x',type:'socket',wall:'back',offset:1960,fromFloor:900,width:80,height:80,depth:12});
});

test('п.3: старое окно передней стены Г-комнаты — на переднюю стену контура, не на правую стенку выреза',()=>{
  const p=preset('L'),o=p.room.outline!,e=openingEdge(p.room,win({wall:'front',offset:2100,width:1800}));
  assert.equal(e.edge,2);assert.equal(edgeLength(o,2),2000);assert.ok(Math.abs(e.offset-100)<0.2,String(e.offset));
  assert.deepEqual(itemEdge(p.room,win({wall:'front',offset:2100,width:1800})),{edge:2,offset:e.offset},'редактор — то же правило');
  // окно у левого края передней стороны — на нижнюю переднюю стену
  assert.equal(openingEdge(p.room,win({wall:'front',offset:300,width:800})).edge,4);
  // стороны нет (у пятиугольника нет… у всех есть) — проверка запасного пути: правая стена у Г-комнаты одна, левая одна
  assert.equal(openingEdge(p.room,win({wall:'right',offset:200,width:800})).edge,1);
});

test('п.4: дверь передней стены (петля справа) и окно с подоконником: после смены формы створка и подоконник на том же месте',()=>{
  const p=newProject();
  const door:Opening={id:'d',type:'door',wall:'front',offset:600,width:800,height:2000,sill:0,hinge:'right'};
  const w:Opening={...win({id:'w',wall:'left',offset:900,width:1000}),windowSill:{width:1300,thick:40,overhang:60,offset:820}};
  p.room.openings=[door,w];assert.deepEqual(projectErrors(p),[]);
  const probes=[{x:900,z:2500},{x:1500,z:2200},{x:300,z:1000}];
  const frame=(q:Project,o:Opening)=>probes.map(pt=>openingSweepPoint(o,q.room,pt));
  const before=frame(p,door),sill0=sillCenter(p.room,w as any);
  const r=applyOutline(p,chamferCorner(rectOutline(4000,3000),1,750),cornerEdgeMap(4,1));
  assert.equal(r.problem,undefined);const n=r.project,d2=n.room.openings!.find(o=>o.id==='d')!,w2=n.room.openings!.find(o=>o.id==='w')!;
  assert.equal(d2.edge,3);assert.equal(d2.hinge,'left','старая «правая» передней стены — начало стены контура');
  frame(n,d2).forEach((q,i)=>{assert.ok(Math.abs(q.x-before[i].x)<0.2&&Math.abs(q.z-before[i].z)<0.2,JSON.stringify([q,before[i]]));});
  const sill1=sillCenter(n.room,w2 as any);assert.ok(Math.hypot(sill1.x-sill0.x,sill1.z-sill0.z)<0.2,JSON.stringify([sill0,sill1]));
  assert.deepEqual(projectErrors(n),[]);
  // обратно в прямоугольник — снова старые правила, и всё на месте
  const back=applyOutline(n,rectOutline(4000,3000)).project,d3=back.room.openings!.find(o=>o.id==='d')!,w3=back.room.openings!.find(o=>o.id==='w')!;
  assert.equal(back.room.outline,undefined);assert.equal(d3.hinge,'right');assert.equal(d3.edge,undefined);
  frame(back,d3).forEach((q,i)=>{assert.ok(Math.abs(q.x-before[i].x)<0.2&&Math.abs(q.z-before[i].z)<0.2);});
  const sill3=sillCenter(back.room,w3 as any);assert.ok(Math.hypot(sill3.x-sill0.x,sill3.z-sill0.z)<0.2);
  assert.equal(w3.windowSill!.offset,820);
});

test('п.5: «Ближние стены» — камера между хордой и вогнутой дугой прячет эту стену',()=>{
  const o=withOutline(newProject().room,setBulge(rectOutline(4000,3000),0,-500)).outline!;
  assert.deepEqual([...hiddenEdges(o,{x:2000,z:200})],[0],'за вогнутой стеной, но перед хордой');
  assert.deepEqual([...hiddenEdges(o,{x:2000,z:-300})],[0]);
  assert.deepEqual([...hiddenEdges(o,{x:2000,z:1500})],[],'в комнате — ничего');
});

test('п.6: Базис — сдвиг подоконника по проекции стены, петля на месте, пометка о проёмах, которые не уйдут',()=>{
  const p=preset('chamfer');
  // окно на скосе заднего правого угла (ребро 1, к задней стороне габарита), подоконник сдвинут на 300 вдоль стены от середины окна
  p.room.openings=[win({wall:'back',edge:1,offset:100,width:600,windowSill:{width:800,thick:40,overhang:60,offset:300}}),{id:'d',type:'door',wall:'front',edge:3,offset:500,width:800,height:2000,sill:0,hinge:'right'}];
  assert.deepEqual(projectErrors(p),[]);
  const back=importBazisConfig(exportBazisConfig(p.room,'Т')).room,w=back.openings!.find(o=>o.type==='window')!,d=back.openings!.find(o=>o.type==='door')!;
  const shift=(w.windowSill!.offset+w.windowSill!.width/2)-(w.offset+w.width/2);
  assert.ok(Math.abs(shift-300*Math.SQRT1_2)<1,String(shift));
  // петля «справа» по стене контура (конец стены — левее) → в Базис по старым правилам передней стены «левая»
  assert.equal(d.hinge,'left');
  assert.equal(bazisExportNote(p.room),BAZIS_OUTLINE_NOTE);
  // Г-комната: два окна на двух передних стенах — на одну сторону габарита; второе в Базис не уйдёт
  const l=preset('L');l.room.openings=[win({id:'a',edge:2,offset:100}),win({id:'b',edge:4,offset:100})];
  assert.deepEqual(projectErrors(l),[]);
  assert.match(bazisExportNote(l.room)!,/окно 2 — в Базис уйдёт только первое окно передней/);
});

test('п.7: эркер — второй шкаф рядом с первым по хорде, не вторым рядом посреди комнаты',()=>{
  const p=preset('bay');p.modules[0].z=1000;assert.deepEqual(projectErrors(p),[]);
  const n=appendModule(p,p.modules[0].module),a=bounds(n.modules[0]),b=bounds(n.modules[1]);
  assert.equal(b.z,a.z);assert.equal(b.x,a.x+a.w);assert.deepEqual(projectErrors(n),[]);
});

test('п.8: последний шаг тяги — упереться в стену (после Q, Alt/Ctrl, без привязки)',()=>{
  const p=preset('pentagon'),a=p.modules[0],poly=flatten(p.room.outline!);
  const next=keepInRoom(p,a.id,{x:3350,y:0,z:2350});
  assert.ok(polygonInOutline(moduleFootprint({...a,x:next.x,z:next.z}),poly));assert.ok(next.x>a.x&&next.z>a.z);
  const r=newProject();assert.deepEqual(keepInRoom(r,r.modules[0].id,{x:3350,y:0,z:2350}),{x:3350,y:0,z:2350},'прямоугольник — как есть');
});

test('п.9: объект замера в срезанном углу — вне комнаты',()=>{
  const p=preset('chamfer');
  p.room.obstacles=[{id:'o',name:'Колонна',type:'column',x:3700,y:0,z:50,width:250,depth:250,height:2700}];
  assert.match(projectErrors(p)[0],/Колонна/);
  p.room.obstacles[0].x=2000;p.room.obstacles[0].z=1500;assert.deepEqual(projectErrors(p),[]);
});

test('п.10: линии Alt/Ctrl правки формы — каждая стена один раз, старое место едущей дуги не ловит',()=>{
  const p=preset('bay'),o=p.room.outline!,segs=toSegments(candidateLines([],PLAN_LOOK,undefined,p.room),PLAN_LOOK);
  const walls=segs.filter(s=>s.what==='стена'),arc=segs.filter(s=>s.what==='дуга стены');
  assert.equal(walls.length,3);assert.ok(arc.length>4);
  const left=offWalls(segs,o,[0]);assert.equal(left.filter(s=>s.what==='дуга стены').length,0,'едущая дуга убрана');
  assert.equal(left.filter(s=>s.what==='стена').length,3);
  const keys=left.map(s=>[s.a.h,s.a.v,s.b.h,s.b.v].map(Math.round).join());assert.equal(new Set(keys).size,keys.length,'без двойников');
  // два проёма на разных стенах с одним старым именем — не «пересекаются»
  const q=preset('L');q.room.openings=[win({id:'a',wall:'front',edge:2,offset:100}),win({id:'b',wall:'front',edge:4,offset:100})];
  assert.deepEqual(projectErrors(q),[]);
});
