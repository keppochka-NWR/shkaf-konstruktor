// Контур помещения произвольной формы (задача Макса 30.10.2026): скосы, 5 углов, скругления, дуги.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,parseProject,projectErrors} from '../src/project';
import {rectOutline,roomOutline,normalizeOutline,outlineError,flatten,pointInOutline,polygonInOutline,edgeLength,edgeArc,outlineBounds,outlineArea,
  chamferCorner,roundCorner,insertVertex,removeVertex,setEdgeLength,setBulge,cornerAngle,outlinePreset,withOutline,isPlainRect,radiusFromSagitta,sagittaFromRadius} from '../src/roomOutline';

test('прямоугольник: без контура — width × depth, хранить не нужно',()=>{
  const r=newProject().room;
  assert.deepEqual(roomOutline(r),rectOutline(4000,3000));
  assert.ok(isPlainRect(rectOutline(4000,3000)));
  assert.equal(normalizeOutline(rectOutline(4000,3000)).outline,undefined);
  assert.equal(withOutline(r,rectOutline(3500,2800)).outline,undefined);
  assert.equal(withOutline(r,rectOutline(3500,2800)).width,3500);
});

test('нормализация: обход в обратную сторону и сдвиг — как у прямоугольника, габарит от 0',()=>{
  const back=[{x:100,z:100},{x:100,z:3100},{x:4100,z:3100},{x:3100,z:100}];
  const n=normalizeOutline(back);
  assert.ok(n.outline);assert.equal(n.width,4000);assert.equal(n.depth,3000);
  assert.ok(outlineArea(n.outline!)>0);
  assert.equal(outlineError(n.outline),null);
});

test('скос угла: 5 стен, угол 135°, площадь меньше на треугольник',()=>{
  const o=chamferCorner(rectOutline(4000,3000),1,600);
  assert.equal(o.length,5);
  assert.deepEqual(o[1],{x:3400,z:0});assert.deepEqual(o[2],{x:4000,z:600});
  assert.equal(cornerAngle(o,1),135);assert.equal(cornerAngle(o,2),135);
  assert.ok(Math.abs(outlineArea(o)-(12e6-600*600/2))<1);
  assert.equal(outlineError(o),null);
});

test('дуга: стрела, радиус, длина стены; эркер расширяет габарит',()=>{
  const o=setBulge(rectOutline(4000,3000),0,500);
  const a=edgeArc(o[0],o[1],500)!;
  assert.ok(Math.abs(a.R-radiusFromSagitta(4000,500))<1e-6);
  assert.ok(Math.abs(sagittaFromRadius(4000,a.R)-500)<1e-6);
  assert.ok(edgeLength(o,0)>4000&&edgeLength(o,0)<4200);
  const b=outlineBounds(o);assert.ok(Math.abs(b.z0+500)<1,'наружу — за задней стеной');
  const n=normalizeOutline(o);assert.equal(n.depth,3500);assert.equal(n.outline![0].z,500);
  assert.ok(pointInOutline({x:2000,z:100},n.outline!),'в эркере');
  // внутрь
  const inn=setBulge(rectOutline(4000,3000),0,-500);
  assert.ok(!pointInOutline({x:2000,z:100},inn),'выступ стены внутрь');
});

test('скругление угла: две точки касания, дуга срезает угол, угол комнаты снаружи',()=>{
  const o=roundCorner(rectOutline(4000,3000),1,1000);
  assert.equal(o.length,5);
  assert.deepEqual([o[1].x,o[1].z],[3000,0]);assert.deepEqual([o[2].x,o[2].z],[4000,1000]);
  assert.ok(o[1].bulge!>0);
  // середина дуги — на радиусе 1000 от центра (3000;1000)
  const mid=flatten(o).pts.filter((_,k)=>flatten(o).edge[k]===1);const m=mid[Math.floor(mid.length/2)];
  assert.ok(Math.abs(Math.hypot(m.x-3000,m.z-1000)-1000)<2);
  assert.ok(!pointInOutline({x:3950,z:50},o),'угол срезан');
  assert.equal(outlineError(o),null);
});

test('точки: вставить на стене, удалить; длина стены',()=>{
  const r=rectOutline(4000,3000),i=insertVertex(r,0,0.25);
  assert.equal(i.length,5);assert.deepEqual([i[1].x,i[1].z],[1000,0]);
  assert.equal(removeVertex(i,1).length,4);
  const l=setEdgeLength(r,0,3500);assert.deepEqual([l[1].x,l[1].z],[3500,0]);
  // дуга делится: стрелы половинок меньше
  const arc=insertVertex(setBulge(r,0,400),0,0.5);assert.ok(arc[0].bulge!>0&&arc[0].bulge!<400&&arc[1].bulge!>0);
  assert.ok(Math.abs(arc[1].z+400)<1,'точка — на вершине дуги');
});

test('ошибки контура: мало точек, короткая стена, самопересечение, дуга больше полукруга',()=>{
  assert.match(outlineError([{x:0,z:0},{x:1000,z:0}])!,/от 3/);
  assert.match(outlineError([{x:0,z:0},{x:20,z:0},{x:20,z:1000},{x:0,z:1000}])!,/короче/);
  assert.match(outlineError([{x:0,z:0},{x:1000,z:1000},{x:1000,z:0},{x:0,z:1000}])!,/пересекает|обход/);
  assert.match(outlineError(setBulge(rectOutline(4000,3000),0,2500))!,/полуокружности/);
});

test('заготовки форм — все корректны, Г-образная вогнута (угол 270°)',()=>{
  for(const k of ['rect','chamfer','pentagon','L','rounded','bay'] as const){
    const n=normalizeOutline(outlinePreset(k,4000,3000));
    assert.equal(outlineError(n.outline??rectOutline(n.width,n.depth)),null,k);
  }
  const L=outlinePreset('L',4000,3000);assert.equal(cornerAngle(L,3),270);
});

test('корпус в комнате: внутри контура — да, в срезанном углу или в вырезе Г — ошибка',()=>{
  const p=newProject();p.room=withOutline(p.room,outlinePreset('L',4000,3000));
  const m=p.modules[0];m.x=100;m.z=30;
  assert.deepEqual(projectErrors(p).filter(e=>/границы/.test(e)),[]);
  m.x=3000;m.z=2000; // в вырезе Г (правый передний квадрант)
  assert.ok(projectErrors(p).some(e=>/границы/.test(e)));
  // сохранение и открытие — контур сохраняется
  m.x=100;m.z=30;
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(back.room.outline,p.room.outline);
  const sq=[{x:0,z:0},{x:500,z:0},{x:500,z:500},{x:0,z:500}];
  assert.ok(polygonInOutline(sq.map(q=>({x:q.x+100,z:q.z+100})),flatten(p.room.outline!)));
  assert.ok(!polygonInOutline(sq.map(q=>({x:q.x+1800,z:q.z+1300})),flatten(p.room.outline!)),'угол выреза внутри корпуса');
});

test('битый контур в файле — понятная ошибка, а не падение',()=>{
  const p=newProject() as any;p.room.outline=[{x:0,z:0},{x:'a',z:0},{x:10,z:10}];
  assert.throws(()=>parseProject(JSON.parse(JSON.stringify(p))),/Контур помещения/);
  const q=newProject() as any;q.room.outline=rectOutline(3000,3000);q.room.outline[1].bulge=300;
  assert.throws(()=>parseProject(JSON.parse(JSON.stringify(q))),/габарит/);
});

test('точка на стене, ближайшая стена, старые проёмы → стены контура',async()=>{
  const {edgePoint,projectToEdges,legacyToEdge,edgeTangent}=await import('../src/roomOutline');
  const r=rectOutline(4000,3000);
  assert.deepEqual(edgePoint(r,2,1000),{x:3000,z:3000},'передняя идёт справа налево');
  assert.deepEqual(projectToEdges(r,{x:3000,z:2900}),{edge:2,s:1000,dist:100});
  // окно на передней стене от левой 500, ширина 1200 → по обходу от правого угла 4000−500−1200
  assert.deepEqual(legacyToEdge(4000,3000,'front',500,1200),{edge:2,offset:2300});
  assert.deepEqual(legacyToEdge(4000,3000,'right',500,1200),{edge:1,offset:500});
  const arc=setBulge(r,0,500),L=edgeLength(arc,0),m=edgePoint(arc,0,L/2);
  assert.ok(Math.abs(m.x-2000)<1&&Math.abs(m.z+500)<1,'середина дуги — вершина');
  const n=edgeTangent(arc,0,L/2).n;assert.ok(Math.abs(n.x)<1e-6&&Math.abs(n.z-1)<1e-6,'внутрь комнаты');
});
