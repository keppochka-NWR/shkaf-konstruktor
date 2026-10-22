// B2 (релиз 22.10): торцевые ручки (HEXA L-1200, FP527) — коробки проверки по модели ручки, пара на сходящихся кромках — понятная проверка.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,parts,type Module} from '../src/model';
import {withDoorCount} from '../src/paletteDoors';
import {partCollisions,partPenetration,edgePullGaps,LEAF_GAP_MIN} from '../src/collisions';
import {collisionWarnings} from '../src/roomWarnings';
import {buildCheck} from '../src/buildCheck';
import {newProject,type Project} from '../src/project';
import {handleSpec,handleById} from '../src/handles';

const cabinet=(handleId:string,doors=2,width=1158):Module=>{const m=withDoorCount({...initialModule(),name:'Пустой шкаф',width,height:2400,depth:550,sections:[section()]},doors);m.handleId=handleId;return m;};
const project=(m:Module):Project=>{const p=newProject();p.modules=[{...p.modules[0],module:m}];return p;};
const EDGE=['hexa1200a','hexa1200b','fp527-160'];

test('торцевая ручка на своём фасаде: коробки по модели — стенка за кромкой, губка над лицом; со своим и соседним фасадом не пересекается',()=>{
 for(const id of EDGE){
  const m=cabinet(id,1,600),ps=parts(m),door=ps.find(p=>p.role==='door')!,h=ps.find(p=>p.role==='handle')!;
  const sp=handleSpec(handleById(id));
  assert.equal(h.edgeWall,sp.section,id+': стенка торцевой ручки отмечена');
  assert.equal(h.collide?.length,2,id+': две коробки — стенка и губка');
  const [wall,lip]=h.collide!,front=door.position[2]+door.size[2]/2,free=door.hinge==='right'?door.position[0]-door.size[0]/2:door.position[0]+door.size[0]/2,out=Math.sign(free-door.position[0]);
  // стенка — за свободной кромкой (касается торца), от тыла фасада до выноса
  assert.ok(Math.abs(wall.position[0]-out*wall.size[0]/2-free)<1e-6,id+': стенка начинается от кромки фасада');
  assert.ok(Math.abs(wall.position[2]-wall.size[2]/2-(front-door.size[2]))<1e-6,id+': стенка от тыла фасада');
  assert.ok(lip.position[2]-lip.size[2]/2>=front,id+': губка над лицом фасада');
  assert.ok(partPenetration(h,door)<=0,id+': ручка не заходит в свой фасад');
  assert.equal(partCollisions(ps,m).length,0,id+': одна створка — пересечений нет');
 }
});

test('пара створок 1158×2400 с HEXA L-1200 на сходящихся кромках: нет «Фасад × Ручка», одна понятная проверка зазора вместо «сдвиньте полку или петлю»',()=>{
 for(const id of EDGE){
  const m=cabinet(id),ps=parts(m);
  const c=partCollisions(ps,m);
  assert.ok(!c.some(x=>x.names.some(n=>n.startsWith('Фасад'))),id+': фасад × ручка — не пересечение (было 1 мм ×2)');
  const g=edgePullGaps(ps);
  assert.equal(g.length,1,id+': одна пара створок');
  assert.equal(g[0].handles.length,2);assert.equal(g[0].gap,2);assert.equal(g[0].need,2*handleSpec(handleById(id)).section+LEAF_GAP_MIN);assert.equal(g[0].sameSection,true);
  const w=collisionWarnings(project(m));
  assert.equal(w.length,1,id+': одно сообщение');
  assert.match(w[0].message,/торцевые ручки на сходящихся кромках/);
  assert.match(w[0].message,/нужен зазор не меньше 6 мм/);
  assert.match(w[0].message,/«Зазор между створками» секции до 6 мм/);
  assert.doesNotMatch(w[0].message,/Сдвиньте полку или петлю/);
  const p=project(m),b=buildCheck(p,p.modules[0].id);
  assert.equal(b.ok,false);assert.equal(b.title,'Торцевые ручки: мал зазор между створками');
 }
});

test('зазор между створками 6 мм — торцевые ручки пары помещаются: ни пересечений, ни предупреждений',()=>{
 const m=cabinet('hexa1200a');m.sections[0].doorGap=6;
 const ps=parts(m);
 assert.equal(partCollisions(ps,m).length,0);assert.equal(edgePullGaps(ps).length,0);assert.equal(collisionWarnings(project(m)).length,0);
});

test('одна торцевая ручка у соседней обычной створки: стенка в зазоре 2 мм — нужно 4 мм; обычные ручки и накладной профиль — без предупреждений',()=>{
 const m=cabinet('uz819-128');const s=m.sections[0];s.doorHandles=['fp527-160',null,null,null];
 const g=edgePullGaps(parts(m));assert.equal(g.length,1);assert.equal(g[0].handles.length,1);assert.equal(g[0].need,4);
 assert.match(collisionWarnings(project(m))[0].message,/торцевая ручка у соседней створки/);
 for(const id of ['uz819-128','lm89449590','hexa256a']){const n=cabinet(id);assert.equal(collisionWarnings(project(n)).length,0,id+': без предупреждений');}
});
