import test from 'node:test';
import assert from 'node:assert/strict';
import {hiddenWalls,roomEdges,edgeVisible,readCutaway} from '../src/roomCutaway';

const room={width:3000,depth:2500};
const names=(s:Set<string>)=>[...s].sort();

test('камера внутри комнаты — все стены видны',()=>{
  assert.deepEqual(names(hiddenWalls(room,{x:1500,z:1200})),[]);
  assert.deepEqual(names(hiddenWalls(room,{x:0,z:2500})),[],'на плоскости стены — ещё не снаружи');
});

test('камера снаружи — скрыта стена между камерой и комнатой',()=>{
  assert.deepEqual(names(hiddenWalls(room,{x:1500,z:-100})),['back']);
  assert.deepEqual(names(hiddenWalls(room,{x:1500,z:9000})),['front']);
  assert.deepEqual(names(hiddenWalls(room,{x:-5,z:1200})),['left']);
  assert.deepEqual(names(hiddenWalls(room,{x:7000,z:1200})),['right']);
  assert.deepEqual(names(hiddenWalls(room,{x:7000,z:9000})),['front','right'],'изометрия с угла — две ближние стены');
});

test('режим «Все стены» и неверная камера — ничего не скрывается',()=>{
  assert.deepEqual(names(hiddenWalls(room,{x:7000,z:9000},false)),[]);
  assert.deepEqual(names(hiddenWalls(room,{x:Number.NaN,z:9000})),[]);
});

test('12 рёбер: углы принадлежат двум стенам, периметр — одной',()=>{
  const e=roomEdges(3000,2700,2500);
  assert.equal(e.length,12);
  assert.equal(e.filter(x=>x.walls.length===2).length,4);
  for(const w of ['back','front','left','right'] as const)assert.equal(e.filter(x=>x.walls.includes(w)).length,4,w);
  const corner=e.find(x=>x.a[0]===3000&&x.a[2]===2500&&x.b[1]===2700)!;
  assert.deepEqual([...corner.walls].sort(),['front','right']);
});

test('ребро видно, только если видны все его стены',()=>{
  const hidden=hiddenWalls(room,{x:1500,z:9000});
  const e=roomEdges(3000,2700,2500),visible=e.filter(x=>edgeVisible(x.walls,hidden));
  assert.equal(visible.length,8,'передняя стена: 2 горизонтали + 2 угла скрыты');
  assert.ok(visible.every(x=>!x.walls.includes('front')));
});

test('настройка по умолчанию ВКЛ без localStorage',()=>{assert.equal(readCutaway(),true);});
