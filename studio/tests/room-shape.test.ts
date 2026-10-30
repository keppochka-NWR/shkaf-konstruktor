// Правка формы помещения (задача Макса 30.10.2026): перенос стены, длина стены, угол, растяжение; проёмы и объекты на своих
// стенах (перенумерация при вставке/удалении точки, отступ — в длину стены), мебель на месте плана; короткие причины отказа.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,type Project} from '../src/project';
import {rectOutline,outlinePreset,chamferCorner,insertVertex,removeVertex,moveEdge,setWallLength,setCornerAngle,scaleOutline,projectToEdge,
  edgeLength,cornerAngle,setBulge,insertEdgeMap,removeEdgeMap,cornerEdgeMap,moveEdgeMap,sameEdges,roomOutline} from '../src/roomOutline';
import {applyOutline,shapeEdit,shapeProblem,itemEdge,legacyWall,parseShiftTyped,parseWallTyped,snapVertex,wallRows,wallName} from '../src/roomShape';

const win=(id:string,wall:'back'|'left'|'right'|'front',offset:number,width=1000)=>({id,type:'window' as const,wall,offset,width,height:1200,sill:900});
const room=(openings=[win('w','back',500)]):Project=>{const p=newProject();p.room={...p.room,openings};p.modules[0].x=1000;p.modules[0].z=30;return p;};

test('перенос стены: прямоугольник остаётся прямоугольником, без контура',()=>{
  const p=room(),r=applyOutline(p,moveEdge(rectOutline(4000,3000),1,500),moveEdgeMap(4,1)).project;
  assert.equal(r.room.outline,undefined);assert.equal(r.room.width,4500);assert.equal(r.room.depth,3000);
  assert.deepEqual(r.room.openings![0],{...win('w','back',500)},'окно на задней стене на месте');
  assert.equal(r.modules[0].x,1000);
});

test('перенос левой стены наружу: мебель, окно, размеры и линии Q на месте плана (габарит снова от 0)',()=>{
  const p=room();p.dimensions=[{id:'d',from:[100,100],to:[900,100]}];p.guides=[{id:'g',look:[0,1,0],n:[1,0,0],at:1600}];
  const r=applyOutline(p,moveEdge(rectOutline(4000,3000),3,200),moveEdgeMap(4,3)).project;
  assert.equal(r.room.width,4200);assert.equal(r.room.outline,undefined);
  assert.equal(r.modules[0].x,1200,'корпус стоит на месте — левая стена ушла');
  assert.equal(r.room.openings![0].offset,700,'окно на месте: от левой стены дальше на 200');
  assert.deepEqual(r.dimensions![0].from,[300,100]);assert.equal(r.guides![0].at,1800);
});

test('длина стены: следующая стена переносится параллельно, углы на месте',()=>{
  const o=setWallLength(rectOutline(4000,3000),0,3500);
  assert.deepEqual(o.map(q=>[q.x,q.z]),[[0,0],[3500,0],[3500,3000],[0,3000]]);
  const c=chamferCorner(rectOutline(4000,3000),1,600),l=setWallLength(c,0,3000);
  assert.equal(Math.round(edgeLength(l,0)),3000);assert.equal(cornerAngle(l,1),135);assert.equal(cornerAngle(l,2),135);
  assert.equal(Math.round(edgeLength(l,1)),1414,'скос переехал параллельно себе — длиннее, углы те же');assert.deepEqual([l[2].x,l[2].z],[4000,1000]);
  // дуга: длина по дуге, форма та же
  const a=setBulge(rectOutline(4000,3000),0,400),la=setWallLength(a,0,3800);assert.ok(Math.abs(edgeLength(la,0)-3800)<2);
});

test('угол стены, растяжение контура, точка на стене',()=>{
  const o=setCornerAngle(rectOutline(4000,3000),1,120);assert.equal(cornerAngle(o,1),120);
  assert.ok(Math.abs(edgeLength(o,1)-3000)<0.2,'длина стены та же');
  const s=scaleOutline(chamferCorner(rectOutline(4000,3000),1,600),1.1,1);assert.equal(s[2].x,4400);assert.equal(s[1].x,3740);
  assert.equal(projectToEdge(rectOutline(4000,3000),2,{x:3000,z:2950}),1000);
});

test('перенумерация стен: вставка, удаление, скос, перенос',()=>{
  assert.deepEqual(insertEdgeMap(4,0),[undefined,2,3,4]);
  assert.deepEqual(removeEdgeMap(5,1),[undefined,undefined,1,2,3]);
  assert.deepEqual(removeEdgeMap(5,0),[undefined,0,1,2,undefined]);
  assert.deepEqual(cornerEdgeMap(4,0),[undefined,2,3,4]);assert.deepEqual(cornerEdgeMap(4,1),[0,undefined,3,4]);
  assert.deepEqual(moveEdgeMap(4,3),[undefined,1,2,3]);assert.deepEqual(sameEdges(3),[0,1,2]);
});

test('проёмы при правке контура: номер стены за вставкой точки, отступ — в длину стены, скос и заготовка',()=>{
  // переднее окно (старые правила: от левой стены 500) → стена 2, от её начала (правый угол) 4000−500−1000
  const p=room([win('f','front',500)]);
  assert.deepEqual(itemEdge(p.room,p.room.openings![0]),{edge:2,offset:2500});
  const ins=applyOutline(p,insertVertex(rectOutline(4000,3000),0,0.5),insertEdgeMap(4,0)).project;
  // точка посреди задней стены хранится (5 точек — её потом тянут); переднее окно — теперь стена 3
  assert.equal(ins.room.outline?.length,5);assert.equal(ins.room.openings![0].edge,3);assert.equal(ins.room.openings![0].offset,2500);
  assert.equal(ins.room.openings![0].wall,'front');
  // заготовка «скошенный угол» (без карты — по месту): окно на задней стене на месте
  const ch=applyOutline(room(),outlinePreset('chamfer',4000,3000)).project;
  assert.equal(ch.room.openings![0].edge,0);assert.equal(ch.room.openings![0].offset,500);
  // окно на правой стене, скос угла 1: стена правая теперь короче — отступ в длину стены
  const r=room([win('r','right',1500,1000)]),c=applyOutline(r,chamferCorner(rectOutline(4000,3000),1,750),cornerEdgeMap(4,1)).project;
  const o=c.room.openings![0];assert.equal(o.edge,2);assert.equal(o.wall,'right');assert.ok(Math.abs(o.offset-750)<1,'на месте плана: 1500 − 750 = '+o.offset);
  // удалить точку скоса — стены слиты, окно по месту
  const back=applyOutline(c,removeVertex(c.room.outline!,2),removeEdgeMap(5,2)).project;assert.equal(back.room.openings![0].edge,1);
  // «Сделать прямоугольной»: снова старые стены
  const rect=applyOutline(c,rectOutline(4000,3000)).project;assert.equal(rect.room.outline,undefined);
  assert.equal(rect.room.openings![0].wall,'right');assert.equal(rect.room.openings![0].edge,undefined);assert.ok(Math.abs(rect.room.openings![0].offset-1500)<1);
});

test('объекты на стенах: плинтус во всю стену укорачивается со стеной, проём длиннее стены — отказ',()=>{
  const p=room([]);p.room.fixtures=[{id:'pl',type:'floorPlinth',wall:'back',offset:0,fromFloor:0,width:4000,height:70,depth:25}];
  const r=applyOutline(p,chamferCorner(rectOutline(4000,3000),1,600),cornerEdgeMap(4,1)).project;
  assert.equal(r.room.fixtures![0].edge,0);assert.equal(r.room.fixtures![0].width,3400);
  const q=room([win('w','back',0,3800)]),bad=applyOutline(q,chamferCorner(rectOutline(4000,3000),1,600),cornerEdgeMap(4,1));
  assert.match(bad.problem!,/Окно 1 не помещается на стене 1/);
  assert.equal(legacyWall(rectOutline(4000,3000),3),'left');
});

test('отказ правки: короткая стена, корпус вне комнаты, пересечение стен',()=>{
  const p=room([]);
  assert.equal(shapeEdit(p,moveEdge(rectOutline(4000,3000),1,-3000)).problem,'Корпус «'+p.modules[0].module.name+'» оказывается вне комнаты');
  const short=chamferCorner(rectOutline(4000,3000),1,20);
  assert.equal(shapeEdit(p,short).problem,'Стена 2 короче 50 мм');
  assert.equal(shapeEdit(p,[{x:0,z:0},{x:4000,z:0},{x:0,z:3000},{x:4000,z:3000}]).problem!=null,true);
  assert.equal(shapeEdit(p,outlinePreset('pentagon',4000,3000)).problem,null);
  assert.equal(shapeProblem(p),null);
});

test('набор при тяге: «dx;dz» по мыши, знак минус; перенос стены; привязки угла',()=>{
  assert.deepEqual(parseShiftTyped('600;2400',{x:-5,z:3}),{x:-600,z:2400});
  assert.deepEqual(parseShiftTyped('-600',{x:5,z:0}),{x:-600,z:0});
  assert.deepEqual(parseShiftTyped(';300',{x:0,z:-1}),{x:0,z:-300});
  assert.equal(parseShiftTyped('',{x:0,z:0}),null);assert.equal(parseShiftTyped('1;2;3',{x:0,z:0}),null);
  assert.equal(parseWallTyped('200',-3),-200);assert.equal(parseWallTyped('-150',5),-150);assert.equal(parseWallTyped('x',1),null);
  const s=snapVertex({x:3987,z:13},{x:0,z:0},{x:4000,z:3000},[],[],30);assert.deepEqual(s.p,{x:4000,z:0});
  const g=snapVertex({x:2203,z:1500},{x:0,z:0},{x:4000,z:3000},[2200],[],30);assert.equal(g.p.x,2200);assert.ok(g.what.includes('линия Q'));
  const d=snapVertex({x:1010,z:1000},{x:0,z:0},{x:5000,z:3000},[],[],30);assert.deepEqual(d.p,{x:1005,z:1005});assert.deepEqual(d.what,['стена под 45°']);
});

test('таблица стен: длины, углы, имена',()=>{
  const o=chamferCorner(rectOutline(4000,3000),1,600),rows=wallRows(o);
  assert.deepEqual(rows.map(r=>r.length),[3400,849,2400,4000,3000]);assert.deepEqual(rows.map(r=>r.angle),[90,135,135,90,90]);
  assert.deepEqual(o.map((_,i)=>wallName(o,i)),['задняя','скос','правая','передняя','левая']);
  assert.equal(roomOutline({width:10,depth:20}).length,4);
});
