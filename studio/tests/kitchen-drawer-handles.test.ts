// Критик 28.10.2026: «Нижний с ящиками» из шаблона «Кухня прямая» — фасады ящиков без ручек (ручка ставилась только по проекту Базиса).
// Ящикам — ручка модуля (та же, что у дверей кухни), в модели и в смете; модули Базиса и Gola/«без ручек» — без изменений.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,facadeHandleId} from '../src/model';
import {createKitchenRow} from '../src/ModulePalette';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {handleById} from '../src/handles';

const kitchen=():Project=>({...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())});

test('кухня прямая: у каждого фасада ящика «Нижнего с ящиками» есть ручка — та же, что у дверей кухни; в смете ручек столько же',()=>{
  const p=kitchen(),dr=p.modules.find(a=>a.module.kdrawers?.length&&!a.module.doors);
  assert.ok(dr,'в шаблоне есть нижний с ящиками');
  const ps=parts(dr!.module),fronts=ps.filter(x=>/^kd:\d+:facade$/.test(x.id)),handles=ps.filter(x=>x.role==='handle'&&/^kd:\d+:drawer:handle$/.test(x.id));
  assert.ok(fronts.length>=3);assert.equal(handles.length,fronts.length,'ручка на каждом фасаде ящика');
  for(const h of handles){const f=ps.find(x=>x.id===h.id.replace(':drawer:handle',':facade'))!;
    assert.ok(Math.abs(h.position[0]-f.position[0])<0.5,'по центру');assert.ok(h.position[1]<f.position[1]+f.size[1]/2&&h.position[1]>f.position[1],'у верхней кромки');}
  const doorMod=p.modules.find(a=>a.module.doors&&parts(a.module).some(x=>x.role==='handle'));
  if(doorMod){const dh=parts(doorMod.module).find(x=>x.role==='handle')!;assert.equal(handleById(facadeHandleId(dr!.module,handles[0].id)).id,handleById(facadeHandleId(doorMod.module,dh.id)).id,'ручка как у дверей');}
  const e=estimate({...p,modules:[dr!]}),hid=handleById(facadeHandleId(dr!.module,handles[0].id)).id,line=e.lines.find(l=>l.id==='handle:'+hid);
  assert.ok(line,'строка ручки в смете');assert.equal(line!.quantity,handles.length);
});

test('ящики без ручек: «без ручек» (Gola, noHandles) и push-to-open — ручек нет',()=>{
  const p=kitchen(),dr=p.modules.find(a=>a.module.kdrawers?.length&&!a.module.doors)!;
  for(const patch of [{noHandles:true},{doorOpen:'push' as const}]){
    const m={...structuredClone(dr.module),...patch};
    assert.equal(parts(m).filter(x=>x.role==='handle').length,0,JSON.stringify(patch));
  }
});
