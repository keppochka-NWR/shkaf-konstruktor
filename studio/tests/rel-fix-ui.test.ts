// Критик релиза 22.10, UI-пункты: m4 — причина, почему не добавить ящик; m6 — высота ручек от пола для всех дверей модуля.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createModule} from '../src/ModulePalette';
import {initialModule,boxes,parts,doorHandleFloorInfo,RULES} from '../src/model';
import {newProject,projectErrors,type Project} from '../src/project';
import {insertItem} from '../src/operations';
import {drawerAddReason,drawerCapacity,drawerFitsOnTop} from '../src/drawerLimit';
import {moduleHandleFloor,setModuleHandleFloor} from '../src/handleFloorGroup';

const wardrobe=(shelves:number[]|null,rod:boolean):Project=>{
  const p=newProject();p.room={...p.room,width:2400};
  const m=createModule('wardrobe',1200,2400,550,initialModule(),2),s=m.sections[0],b=boxes(m).find(x=>x.id===s.id)!;
  if(shelves)s.shelves=shelves.map(v=>v/(b.top-b.bottom));s.rod=rod;
  return {...p,modules:[{id:'a',x:0,y:0,z:30,rotation:0,module:m}]};
};
const sid=(p:Project)=>p.modules[0].module.sections[0].id;
const addDrawer=(p:Project)=>{const m=p.modules[0].module,s=m.sections[0],b=boxes(m).find(x=>x.id===s.id)!;
  const top=s.drawers?Math.max(...Array.from({length:s.drawers},(_,j)=>(s.drawerConfigs?.[j]?.y??0)))+180:0;return insertItem(p,'drawer','a',s.id,b.bottom+top);};

test('m4: третий ящик под низкой полкой — причина с правилом, свободной высотой и пределом секции',()=>{
  let p=wardrobe([560,1160,1724],false);
  assert.deepEqual(projectErrors(p),[]);
  p=addDrawer(p);p=addDrawer(p);
  assert.equal(p.modules[0].module.sections[0].drawers,2);
  const why=drawerAddReason(p,'a',sid(p));
  assert.match(why,/^Ящик 3 не помещается: /);
  assert.match(why,/80 мм/,'правило, которое нарушает ящик');
  assert.match(why,/до полки 1 свободно \d+ мм, сам ящик — \d+ мм/);
  assert.match(why,/помещается 2 ящика/);
  assert.match(why,/полку 1/);
  assert.equal(drawerCapacity(p,'a',sid(p)),2);
  assert.equal(drawerFitsOnTop(p,'a',sid(p)),false,'счётчик не перебирает все высоты, а сразу показывает причину');
});
test('m4: при свободной секции ёмкость больше текущей, предел — RULES.maxDrawers',()=>{
  const p=addDrawer(wardrobe([1629],true));
  const cap=drawerCapacity(p,'a',sid(p));
  assert.ok(cap>1&&cap<=RULES.maxDrawers,'cap='+cap);
  assert.equal(drawerFitsOnTop(p,'a',sid(p)),true);
  const full=structuredClone(p),s=full.modules[0].module.sections[0];s.drawers=RULES.maxDrawers;
  assert.match(drawerAddReason(full,'a',s.id),/уже 5 ящиков/);
});
test('m6: высота ручек от пола задаётся всем распашным дверям модуля и сбрасывается на правило',()=>{
  const m=createModule('wardrobe',1200,2400,550,initialModule(),2);
  const g=moduleHandleFloor(m);
  assert.ok(g,'двери с вертикальной ручкой');assert.equal(g!.ids.length,2);assert.equal(g!.set,false);
  setModuleHandleFloor(m,1100);
  for(const id of g!.ids){const hf=doorHandleFloorInfo(m,id)!;assert.equal(hf.set,true);assert.equal(hf.value,1100);}
  const after=moduleHandleFloor(m)!;assert.equal(after.mixed,false);assert.equal(after.value,1100);
  setModuleHandleFloor(m,null);
  assert.equal(moduleHandleFloor(m)!.set,false);
  assert.ok(parts(m).some(p=>p.role==='handle'));
});
test('m6: push-to-open — поля нет',()=>{
  const m=createModule('wardrobe',1200,2400,550,initialModule(),2);m.doorOpen='push';
  assert.equal(moduleHandleFloor(m),undefined);
});
