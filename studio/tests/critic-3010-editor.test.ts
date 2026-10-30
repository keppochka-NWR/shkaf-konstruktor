// Критик 30.10 по редактору формы помещения (задача Макса 30.10.2026): каждый пункт — регрессия. Пункты 1, 7, 11, 12, 13 (режим
// формы на других этапах, клавиши, Esc, ручка стены, отмена) — в браузерном сценарии scripts/room-shape-3010-scenario.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,projectErrors,type Opening,type Project} from '../src/project';
import {rectOutline,outlinePreset,withOutline,insertVertex,removeVertex,insertEdgeMap,removeEdgeMap,chamferEdit,roundEdit,wallLengthEdit,setWallLength,
  moveEdge,moveEdgeMap,scaleOutline,sameEdges,edgeLength,edgePoint,outlineBounds,ARC_NEXT,type RoomOutline} from '../src/roomOutline';
import {shapeEdit,itemEdge,scaleRoom} from '../src/roomShape';
import {newFixture} from '../src/fixtures';
import {withBazisRoom} from '../src/bazisRoom';

const win=(x:Partial<Opening>):Opening=>({id:'w',type:'window',wall:'back',offset:1500,width:1200,height:1200,sill:900,...x});
const empty=(o?:RoomOutline):Project=>{const p=newProject();p.modules=[];if(o)p.room=withOutline(p.room,o);return p;};
/** Середина проёма/объекта на плане — «стоит на месте». */
const mid=(p:Project,x:{wall:Opening['wall'];edge?:number;offset:number;width:number})=>{const e=itemEdge(p.room,x);return edgePoint(p.room.outline??rectOutline(p.room.width,p.room.depth),e.edge,e.offset+x.width/2);};
const near=(a:{x:number;z:number},b:{x:number;z:number},tol=0.6)=>Math.abs(a.x-b.x)<=tol&&Math.abs(a.z-b.z)<=tol;

test('п.2: точка на стене — проём поперёк точки — отказ; до и после точки — на своей половине на том же месте плана',()=>{
  const o=rectOutline(4000,3000);
  const p=empty();p.room.openings=[win({})];
  const r=shapeEdit(p,insertVertex(o,0,0.5),insertEdgeMap(4,0,2000));
  assert.equal(r.problem,'Окно 1 на месте точки — сдвиньте его');
  const q=empty();q.room.openings=[win({id:'a',offset:500,width:900}),win({id:'b',offset:2500,width:900})];
  const s=shapeEdit(q,insertVertex(o,0,0.5),insertEdgeMap(4,0,2000));
  assert.equal(s.problem,null);
  const [a,b]=s.project.room.openings!;
  assert.deepEqual([a.edge,a.offset,b.edge,b.offset],[0,500,1,500],'второе окно — на второй половине, x 2500 как было');
  assert.ok(near(mid(s.project,b),mid(q,q.room.openings![1])));
  // дверь — «её»
  const d=empty();d.room.openings=[win({type:'door',sill:0,height:2000})];
  assert.equal(shapeEdit(d,insertVertex(o,0,0.5),insertEdgeMap(4,0,2000)).problem,'Дверь 1 на месте точки — сдвиньте её');
});

test('п.2: плинтус во всю стену — во всю стену обеих половин; точку убрали — снова один во всю стену',()=>{
  const p=empty();p.room.fixtures=[newFixture(p.room,'floorPlinth','back','pl')];
  const s=shapeEdit(p,insertVertex(rectOutline(4000,3000),0,0.5),insertEdgeMap(4,0,2000));
  assert.equal(s.problem,null);
  const f=s.project.room.fixtures!;
  assert.equal(f.length,2);assert.deepEqual(f.map(x=>[x.edge,x.offset,x.width]),[[0,0,2000],[1,0,2000]]);
  assert.equal(new Set(f.map(x=>x.id)).size,2,'у второй части свой id');assert.equal(f[0].id,'pl');
  const back=shapeEdit(s.project,removeVertex(s.project.room.outline!,1),removeEdgeMap(5,1));
  assert.equal(back.problem,null);assert.equal(back.project.room.outline,undefined,'снова прямоугольник');
  assert.deepEqual(back.project.room.fixtures!.map(x=>[x.id,x.wall,x.offset,x.width]),[['pl','back',0,4000]]);
});

test('п.3 (уже исправлено 744e08e): ложных отказов нет — проверки по стенам контура',()=>{
  const half=empty(insertVertex(rectOutline(4000,3000),0,0.5));half.room.openings=[win({id:'a',edge:0,offset:100,width:900}),win({id:'b',edge:1,offset:100,width:900})];
  assert.equal(shapeEdit(half,half.room.outline!,sameEdges(5)).problem,null);
  const pl=empty();pl.room.fixtures=[newFixture(pl.room,'floorPlinth','back','pl')];
  assert.equal(shapeEdit(pl,outlinePreset('bay',4000,3000)).problem,null);
  const bay=empty(outlinePreset('bay',4000,3000)),L=edgeLength(bay.room.outline!,0);bay.room.openings=[win({edge:0,offset:L-1000,width:900})];
  assert.ok(L>4000);assert.equal(shapeEdit(bay,bay.room.outline!,sameEdges(4)).problem,null);
  const pent=empty(outlinePreset('pentagon',4000,3000));pent.room.fixtures=[newFixture(pent.room,'floorPlinth','right','pl')];
  const r=shapeEdit(pent,removeVertex(pent.room.outline!,2),removeEdgeMap(5,2));
  assert.equal(r.problem,null);assert.equal(r.project.room.fixtures![0].width,Math.round(edgeLength(r.project.room.outline!,1)*10)/10);
});

test('п.4: скос и скругление рядом с дугой — отказ «Сначала сделайте стену прямой»',()=>{
  const o=outlinePreset('bay',4000,3000);
  assert.equal(chamferEdit(o,1,300),ARC_NEXT);assert.equal(chamferEdit(o,0,300),ARC_NEXT);assert.equal(roundEdit(o,1,300),ARC_NEXT);
  assert.equal(typeof chamferEdit(o,2,300),'object','угол между прямыми — можно');
});

test('п.5: длина стены — проёмы следующей стены на месте плана (запасной путь: следующая стена на одной линии)',()=>{
  const p=empty(insertVertex(rectOutline(4000,3000),0,0.5));p.room.openings=[win({edge:1,offset:500,width:900})];
  const w=wallLengthEdit(p.room.outline!,0,1500),r=shapeEdit(p,w.outline,w.map);
  assert.equal(r.problem,null);
  const o=r.project.room.openings![0];
  assert.deepEqual([o.edge,o.offset],[1,1000],'стена 2 теперь от x 1500 — окно на x 2500, как было');
  assert.ok(near(mid(r.project,o),mid(p,p.room.openings![0])));
  // перенос следующей стены (обычный путь): окно на стене за ней — на месте плана
  const c=empty(outlinePreset('chamfer',4000,3000));c.room.openings=[win({edge:2,offset:600,width:900})];
  const wc=wallLengthEdit(c.room.outline!,0,3000),rc=shapeEdit(c,wc.outline,wc.map);
  assert.equal(rc.problem,null);assert.ok(near(mid(rc.project,rc.project.room.openings![0]),mid(c,c.room.openings![0])));
  assert.deepEqual(setWallLength(rectOutline(4000,3000),0,3500).map(q=>[q.x,q.z]),[[0,0],[3500,0],[3500,3000],[0,3000]],'обёртка — тот же контур');
});

test('п.6: скос/скругление — окно на срезаемой части — отказ; плинтус укорачивается; окно дальше — на месте плана',()=>{
  const p=empty();p.room.openings=[win({wall:'right',offset:100,width:900})];
  const c=chamferEdit(rectOutline(4000,3000),1,750);assert.ok(typeof c!=='string');
  assert.equal(shapeEdit(p,c.outline,c.map).problem,'Окно 1 мешает скосу — сдвиньте его');
  const rd=roundEdit(rectOutline(4000,3000),1,600);assert.ok(typeof rd!=='string');
  assert.equal(shapeEdit(p,rd.outline,rd.map).problem,'Окно 1 мешает скруглению — сдвиньте его');
  // на входящей стене (задняя) у угла — тоже
  const b=empty();b.room.openings=[win({offset:3000,width:900})];assert.equal(shapeEdit(b,c.outline,c.map).problem,'Окно 1 мешает скосу — сдвиньте его');
  // окно дальше от угла и плинтус
  const q=empty();q.room.openings=[win({wall:'right',offset:1500,width:900})];q.room.fixtures=[newFixture(q.room,'floorPlinth','right','pl')];
  const r=shapeEdit(q,c.outline,c.map);assert.equal(r.problem,null);
  const o=r.project.room.openings![0],f=r.project.room.fixtures![0];
  assert.deepEqual([o.edge,o.offset],[2,750]);assert.ok(near(mid(r.project,o),mid(q,q.room.openings![0])));
  assert.deepEqual([f.edge,f.offset,f.width],[2,0,2250],'плинтус — во всю укороченную стену');
  // скос угла 0 (входящая — последняя стена контура)
  const l=empty();l.room.openings=[win({wall:'left',offset:2000,width:600})];
  const c0=chamferEdit(rectOutline(4000,3000),0,500);assert.ok(typeof c0!=='string');
  const r0=shapeEdit(l,c0.outline,c0.map);assert.equal(r0.problem,null);assert.ok(near(mid(r0.project,r0.project.room.openings![0]),mid(l,l.room.openings![0])));
});

test('п.8: стена сквозь противоположную — «Стены пересекаются», а не молча вывернутый контур',()=>{
  const p=empty();
  assert.equal(shapeEdit(p,moveEdge(rectOutline(4000,3000),1,-5000),moveEdgeMap(4,1)).problem,'Стены пересекаются');
  assert.equal(shapeEdit(p,moveEdge(rectOutline(4000,3000),1,-1000),moveEdgeMap(4,1)).problem,null,'просто внутрь — можно');
});

test('п.9: ширина/глубина при контуре — проёмы в ту же долю стены; узкий эркер — стрела не больше полуокружности',()=>{
  const p=empty(outlinePreset('pentagon',4000,3000));p.room.openings=[win({type:'door',sill:0,height:2000,edge:3,offset:500,width:800})];
  const r=scaleRoom(p,'width',3000);assert.equal(r.problem,null);
  const d=r.project.room.openings![0];assert.equal(d.edge,3);assert.equal(d.offset,275,'середина двери — в той же доле передней стены');
  // старый эркер со стрелой 1000 (до п.10) сужается до 1900
  const big=empty(withOutline(newProject().room,[{x:0,z:1000,bulge:1000},{x:4000,z:1000},{x:4000,z:4000},{x:0,z:4000}]).outline);
  const n=scaleRoom(big,'width',1900);assert.equal(n.problem,null);
  assert.ok(Math.abs(n.project.room.outline![0].bulge!)<=950);assert.equal(n.project.room.width,1900);
  // глубина: стрела растягивается вместе с габаритом (габарит ровно набранный)
  assert.equal(scaleRoom(empty(outlinePreset('bay',4000,3000)),'depth',3600).project.room.depth,3600);
  assert.deepEqual(scaleOutline(rectOutline(4000,3000),0.5,1),rectOutline(2000,3000));
});

test('п.10: «Эркер» — в прежнем габарите w × d, дуга наружу',()=>{
  const o=outlinePreset('bay',4000,3000),b=outlineBounds(o);
  assert.deepEqual([b.x0,b.z0,b.x1,b.z1].map(Math.round),[0,0,4000,3000]);
  assert.ok(o[0].bulge!>0);
  const r=shapeEdit(empty(),o);assert.equal(r.problem,null);assert.deepEqual([r.project.room.width,r.project.room.depth],[4000,3000]);
});

test('импорт Config.xml Базиса: контур снимается (замер Базиса прямоугольный), отделка остаётся',()=>{
  const p=empty(outlinePreset('pentagon',4000,3000));p.room.finish={floor:{kind:'laminate'}} as never;
  const room=withBazisRoom(p.room,{width:3500,depth:2800,height:2600,openings:[],fixtures:[],obstacles:[]});
  assert.equal(room.outline,undefined);assert.equal(room.width,3500);assert.deepEqual(room.finish,p.room.finish);
  assert.deepEqual(projectErrors({...p,room},true),[]);
  assert.ok(projectErrors({...p,room:{...p.room,...room,outline:p.room.outline}},true).length,'старое слияние с контуром — отказ');
});
