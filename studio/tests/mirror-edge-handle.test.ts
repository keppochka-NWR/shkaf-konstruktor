// Решение Макса 26.10.2026: зеркальная дверь (зеркало на ЛДСП) открывается торцевой ручкой. Критик 28.10.2026: при выборе зеркала
// оставалась скоба, в смете — скоба. Теперь выбор зеркала ставит торцевую FP527, смета — торцевая по 2 ₽/мм; скоба на зеркале — предупреждение.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,facadeHandleId,mirrorEdgeHandles,mirrorBracketDoors,MIRROR_EDGE_HANDLE} from '../src/model';
import {createModule} from '../src/paletteBuild';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {handleById,handleShape,DEFAULT_HANDLE} from '../src/handles';

const est=(m:ReturnType<typeof initialModule>)=>estimate({...newProject(),modules:[{id:'a',x:100,y:0,z:33,rotation:0,module:m}]});

test('зеркало на фасадах: скобы дверей → торцевая FP527, смета — торцевая 2 ₽/мм, ручки ящиков не меняются',()=>{
  const m=createModule('wardrobe',1200,2200,600,initialModule(),3);
  m.sections[0].drawers=1;
  const drawerBefore=handleById(m.drawerHandleId??m.handleId).id;
  m.mirror='mirror-silver';
  assert.ok(mirrorBracketDoors(m)>0,'до правки — скоба на зеркале');
  mirrorEdgeHandles(m);
  assert.equal(mirrorBracketDoors(m),0);
  const doorHandles=parts(m).filter(p=>p.role==='handle'&&!p.id.includes(':drawer:'));
  assert.ok(doorHandles.length>0);
  for(const h of doorHandles)assert.equal(handleShape(handleById(facadeHandleId(m,h.id))),'edge');
  const line=est(m).lines.find(l=>l.id==='handle:'+MIRROR_EDGE_HANDLE)!;
  assert.ok(line,'строка торцевой ручки');assert.equal(line.unitPrice,2*handleById(MIRROR_EDGE_HANDLE).len);assert.ok(line.retail);
  assert.ok(!est(m).lines.some(l=>l.id==='handle:'+DEFAULT_HANDLE&&l.quantity>=doorHandles.length),'скобы на дверях в смете нет');
  const dh=parts(m).find(p=>p.role==='handle'&&p.id.includes(':drawer:'));
  if(dh)assert.equal(handleById(facadeHandleId(m,dh.id)).id,drawerBefore,'ручка ящика — прежняя');
});

test('зеркало: push-to-open — ручек нет, ничего не ставим; торцевая уже стоит — не меняем',()=>{
  const m=createModule('wardrobe',800,2200,600,initialModule());m.doorOpen='push';m.mirror='mirror-silver';
  mirrorEdgeHandles(m);assert.equal(m.handleId,initialModule().handleId);assert.equal(mirrorBracketDoors(m),0);
  const e=createModule('wardrobe',800,2200,600,initialModule());e.handleId='edge600b';e.mirror='mirror-silver';
  mirrorEdgeHandles(e);assert.equal(e.handleId,'edge600b');
});
