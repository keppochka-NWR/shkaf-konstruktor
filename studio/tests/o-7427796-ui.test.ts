// Заказ 7427796 мышью (26.10.2026): правки интерфейса, без которых менеджер не мог собрать прихожую руками.
// — «Высота фасада ящика» под посадочным местом (полка над ящиками — нет): правка не отказывает «мешает полка» (как validate);
// — «Полка 1» вниз в шкафу «Для одежды»: штанга остаётся на своей высоте (moveShelfKeepRod), а не уезжает под полку;
// — «Антресоль сверху на этот корпус»: не копирует задник «от высоты», добор и зеркало нижнего корпуса.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,validate,parts,type Module} from '../src/model';
import {newProject,projectErrors} from '../src/project';
import {editDrawerConfig} from '../src/drawerEditing';
import {moveShelfKeepRod} from '../src/shelfRod';
import {addUpperModule} from '../src/operations';
import {withPriceMax} from '../src/priceMax';
import {estimate} from '../src/pricing';

const seatModule=():Module=>{const m={...initialModule(),width:702,height:2000,depth:600,doors:false,plinthHeight:0};
  m.sections=[{...section(),shelves:[(442-16)/1968],fixed:[0],thickShelves:[0],drawerCap:false,drawers:1,drawerMount:'inset',
    drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'blum',height:140,facadeH:178,length:550,handle:false,y:202}]}];return m;};

test('фасад ящика под посадочным местом: 196 принимается, выше верха сиденья — понятный отказ', () => {
  const m=seatModule(),s=m.sections[0];
  const ok=editDrawerConfig(m,s,0,{facadeH:196});
  assert.equal(ok[0].facadeH,196);
  assert.deepEqual(validate({...m,sections:[{...s,drawerConfigs:ok}]}),[]);
  assert.throws(()=>editDrawerConfig(m,s,0,{facadeH:230}),/посадочное место/);
  // обычная полка над ящиками (полка над ящиками не снята) — прежнее правило 80 мм
  const plain={...m,sections:[{...s,drawerCap:undefined,thickShelves:undefined}]};
  assert.throws(()=>editDrawerConfig(plain,plain.sections[0],0,{facadeH:196}),/мешает полка/);
});
test('полка вниз в шкафу со штангой: штанга остаётся на своей высоте, правка проходит', () => {
  const m={...initialModule(),width:600,height:2000,depth:582,doors:true};m.sections=[{...section(),shelves:[0.85],rod:true,doorLeaves:1}];
  const before=parts(m).find(p=>p.id.endsWith(':rod'))!.position[1];
  const n=moveShelfKeepRod(m,m.sections[0].id,0,346);
  assert.deepEqual(validate(n),[]);
  assert.equal(Math.round(parts(n).find(p=>p.id.endsWith(':rod'))!.position[1]),Math.round(before));
  assert.equal(Math.round(n.sections[0].shelves[0]*1888),346);
});
test('антресоль сверху: без задника «от высоты», добора и зеркала нижнего корпуса', () => {
  const low={...initialModule(),width:600,height:2000,depth:582,doors:true,backType:'board' as const,backFrom:450,mirror:'mirror-silver',sidePanels:{right:{height:2450,depth:600,thick:32 as const}}};
  low.sections=[{...section(),doorLeaves:1}];
  const p=newProject(low);p.room={...p.room,width:2000,height:2700};
  const n=addUpperModule(p,p.modules[0].id),up=n.modules[1].module;
  assert.equal(up.backFrom,undefined);assert.equal(up.mirror,undefined);assert.equal(up.sidePanels,undefined);
  assert.deepEqual(projectErrors(n),[]);
});
test('«Цена по большей модели» из панели стоимости: priceMax и цена листа, выключение убирает', () => {
  const p=newProject({...initialModule(),width:600,height:2000,depth:550});
  const on=withPriceMax(p,true,23000);
  assert.equal(on.calculation!.priceMax,true);assert.equal(on.calculation!.sheetPrice,23000);
  assert.ok(estimate(on).retail!>=estimate(p).retail!);
  const off=withPriceMax(on,false);assert.equal(off.calculation!.priceMax,undefined);assert.equal(off.calculation!.sheetPrice,23000);
});
