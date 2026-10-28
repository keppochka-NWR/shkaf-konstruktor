// ДП 28.10 (dp-2810, витрина): отдельная панель — не корпус. 1) Плоскость панели сохраняется при разборе проекта и без контура
// (иначе боковая панель МДФ 579×2620 после сохранения проверялась как 2620×579 и отклонялась по паспорту Вернисажа).
// 2) Автофальши: у панели фальшей нет, и корпус рядом с панелью под 90° угловую планку от неё не получает (задняя стенка за витриной).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject,parseProject,applyAutoFillers,projectErrors,type Project} from '../src/project';
import {freePanel} from '../src/freePanels';
import {createModule} from '../src/ModulePalette';

test('отдельная панель: плоскость yz переживает разбор проекта без контура, лицо МДФ — ширина × высота',()=>{
  const a=freePanel({name:'Боковина',width:579,height:2620,thickness:19,plane:'yz',edge:0,decor:'Белый',vernissage:{milling:'15',cover:'enamel-matte',enamelColor:'RAL 1013',thickness:19}});
  const p:Project={...newProject(),room:{width:3000,depth:3000,height:2700,openings:[]},modules:[{...a,x:0,z:0}]};
  const back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.equal(back.modules[0].module.raw!.panels[0].plane,'yz');
  assert.deepEqual(projectErrors(back),[]);
});

test('автофальши: панель за корпусом под 90° не даёт ему угловой планки, у самой панели фальшей нет',()=>{
  const vit=createModule('empty',1035,2000,291,{...initialModule(),decor:'Белый',facadeDecor:'Белый'});
  const panel=freePanel({name:'Задняя стенка',width:517,height:2000,thickness:16,plane:'yz',edge:0,decor:'Белый'});
  // витрина у правой стены (поворот 270) с зазором под панель 16; панель — между стеной и задом витрины
  const p:Project={...newProject(),room:{width:3000,depth:3000,height:2700,openings:[]},modules:[
    {id:'v',x:3000-16-vit.depth-2,z:500,y:0,rotation:270,module:vit},{...panel,id:'p',x:3000-16,z:500,y:0,rotation:0}]};
  const n=applyAutoFillers(p);
  assert.equal(n.modules.find(a=>a.id==='v')!.module.cornerFiller,undefined,'нет угловой планки от панели');
  const q=n.modules.find(a=>a.id==='p')!.module;
  assert.equal(q.cornerFiller,undefined);assert.equal(q.wallFiller,undefined);
});
