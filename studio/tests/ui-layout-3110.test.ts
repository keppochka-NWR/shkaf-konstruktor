// Раскладка экрана (Макс 31.10.2026): клавиша P — «План», меню правой кнопки не заходит на колонку быстрых действий слева,
// иконки видов — все шесть с клавишами в подсказке.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planShortcut,viewShortcut} from '../src/historyShortcuts';
import {menuArea} from '../src/contextMenu';
import {VIEW_BUTTONS} from '../src/SceneToolbar';
import {hasHideableFacades,hiddenWithFacades} from '../src/facadeHide';
import {fitWidths,MIN_SCENE} from '../src/WorkspacePanels';
import {initialModule} from '../src/model';
import {createModule,hangingDrawer} from '../src/paletteBuild';
import {kitchenBase} from '../src/kitchen';

const key=(code:string,extra:Partial<KeyboardEvent>={})=>({code,key:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,target:null,...extra}) as unknown as KeyboardEvent;

test('P — «План»; с модификаторами и автоповтором — нет; виды W A S D E не изменились',()=>{
  assert.equal(planShortcut(key('KeyP')),true);
  assert.equal(planShortcut(key('KeyP',{ctrlKey:true})),false);
  assert.equal(planShortcut(key('KeyP',{shiftKey:true})),false);
  assert.equal(planShortcut(key('KeyP',{repeat:true})),false);
  assert.equal(planShortcut(key('KeyW')),false);
  assert.equal(viewShortcut(key('KeyP')),null);
  assert.equal(viewShortcut(key('KeyA')),'left');
});

test('колонка быстрых действий слева: левый край области меню — правее неё, правый не трогаем',()=>{
  const canvas={left:300,top:142,right:1080,bottom:690},tools={left:308,top:150,right:350,bottom:610};
  const a=menuArea({width:1366,height:768},canvas,tools);
  assert.equal(a.left,356);assert.equal(a.right,1080);
});

test('«Скрыть фасады» по правилу сцены: двери и нижний с ящиками — есть что скрыть; комод и подвесной ящик — нечего',()=>{
  const base=initialModule();
  assert.equal(hasHideableFacades([createModule('wardrobe',800,2000,600,base)]),true,'платяной с дверями');
  assert.equal(hasHideableFacades([kitchenBase(base,600,'drawers')]),true,'нижний кухонный с ящиками');
  assert.equal(hasHideableFacades([createModule('drawers',600,850,550,base)]),false,'комод');
  assert.equal(hasHideableFacades([hangingDrawer(600,300,450,base)]),false,'подвесной ящик');
  assert.equal(hiddenWithFacades({id:'s1:drawer:0:facade',role:'door'}),true,'роль двери — всегда');
  assert.equal(hiddenWithFacades({id:'s1:drawer:0:facade',role:'body'}),false,'фасад ящика — наполнение');
});

test('запомненные колонки на меньшем окне: сцене остаётся минимум, сторона «по экрану» не запоминается',()=>{
  assert.equal(MIN_SCENE,480);
  const a=fitWidths({left:460,right:560},1366,{left:460,right:560});
  assert.equal(a.left,460);assert.equal(a.right,1366-460-MIN_SCENE);
  const b=fitWidths({left:460,right:560},1024,{left:460,right:560});
  assert.equal(b.right,240,'правая до своего минимума');assert.equal(b.left,1024-MIN_SCENE-240,'затем левая');
  const c=fitWidths({left:null,right:560},1024,{left:248,right:560});
  assert.equal(c.left,null);assert.equal(c.right,1024-248-MIN_SCENE);
  const same={left:300,right:300};
  assert.equal(fitWidths(same,1920,same),same,'хватает места — без изменений');
});

test('верхняя полоса: шесть видов (3D, спереди, слева, сбоку, сверху, план), у каждого своя клавиша',()=>{
  assert.deepEqual(VIEW_BUTTONS.map(v=>v.label),['3D','Спереди','Слева','Сбоку','Сверху','План']);
  assert.equal(new Set(VIEW_BUTTONS.map(v=>v.key)).size,6);
});
