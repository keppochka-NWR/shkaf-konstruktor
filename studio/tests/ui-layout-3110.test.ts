// Раскладка экрана (Макс 31.10.2026): клавиша P — «План», меню правой кнопки не заходит на колонку быстрых действий слева,
// виды — все шесть с клавишами в подсказке (Макс 01.11: подписями, не значками), «Параметры» детали ведут к её собственным полям.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planShortcut,viewShortcut} from '../src/historyShortcuts';
import {menuArea} from '../src/contextMenu';
import {VIEW_BUTTONS} from '../src/SceneToolbar';
import {partKind,partIndex,partParamTargets,partSetting} from '../src/partParams';
import {moreState} from '../src/sceneBars';
import {cornerHandleBlock} from '../src/cornerWardrobe';
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

test('верхняя полоса: шесть видов подписями (3D, спереди, слева, справа, сверху, план), у каждого своя клавиша',()=>{
  assert.deepEqual(VIEW_BUTTONS.map(v=>v.label),['3D','Спереди','Слева','Справа','Сверху','План']);
  assert.equal(new Set(VIEW_BUTTONS.map(v=>v.key)).size,6);
  for(const v of VIEW_BUTTONS)assert.ok(v.title.length>0);
});

test('Макс 01.11: подписи не прячутся — в стилях полосы нет скрытия подписей и нулевого шрифта',()=>{
  const css=readFileSync(new URL('../src/ui-layout.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/mode-label\{display:none\}/);
  assert.doesNotMatch(css,/\.view-button\{[^}]*font-size:0/);
});

test('Макс 01.11: «Параметры» — у ящика поля ящика, не секции; у каждой детали свой раздел',()=>{
  assert.equal(partKind('s1:drawer:2:facade'),'drawer');
  assert.equal(partKind('s1:drawer:2:left'),'drawer');
  assert.equal(partKind('s1:drawer:0:facade','door'),'drawer','фасад ящика — часть ящика, даже с ролью двери');
  assert.equal(partKind('s1:shelf:1'),'shelf');
  assert.equal(partKind('s1:door:0','door'),'door');
  assert.equal(partKind('s1:handle:0'),'door');
  assert.equal(partKind('s1:rod'),'rod');
  assert.equal(partKind('s1:rod:lower'),'rod');
  assert.equal(partKind('s1:pantograph:rod'),'rod');
  assert.equal(partKind('s1:pullout:0'),'rod');
  assert.equal(partKind('s1:flange:0'),'rod');
  assert.equal(partKind('s1:divider'),'divider');
  assert.equal(partKind('s1:divider:over'),'divider');
  assert.equal(partKind('s1:left'),'section');
  assert.equal(partSetting('s1:drawer:2:facade'),'Ящики');
  assert.equal(partSetting('s1:divider'),'Перегородки секции');
  assert.equal(partParamTargets('s1:drawer:2:facade')[1],'.properties [data-part-params="drawer"]');
  assert.ok(partParamTargets('s1:drawer:2:facade').indexOf('.properties details[data-setting="Ящики"]')<partParamTargets('s1:drawer:2:facade').indexOf('.properties details[data-setting="Секция"]'),'«Секция» — только запасной путь');
  assert.equal(partParamTargets('s1:left')[0],'.properties details[data-setting="Секция"]');
});

test('критик 01.11: угловой — номер ящика и «Наполнение угла» раньше первого раздела; купе — редактор вставки',()=>{
  assert.equal(partIndex('s1:drawer:2:facade'),2);assert.equal(partIndex('s1:shelf:1'),1);assert.equal(partIndex('s1:door:0'),null);
  const d=partParamTargets('s1:drawer:2:bottom');
  assert.equal(d[0],'.properties [data-part-params="drawer"][data-part-index="2"]');
  const list=partParamTargets('s1:left');
  assert.ok(list.indexOf('.properties details[data-setting="Наполнение угла"]')<list.indexOf('.properties .property-section'),'вступление углового — .property-section — только последним');
  assert.equal(partKind('kupe:1:fill:0:2'),'kupe');
  assert.equal(partParamTargets('kupe:1:fill:0:2')[0],'.properties [data-part-params="kupe"]');
  assert.equal(partKind('kupe:1:side:l'),'section');
  assert.ok(partParamTargets('kupe:1:side:l').includes('.properties .kupe-panel'));
});

test('критик 01.11: ручка углового — серая там, где ничего не меняет; обычный шкаф не затронут',()=>{
  const main={corner:{level:'main'}} as never,upper={corner:{level:'upper'}} as never;
  assert.match(cornerHandleBlock(main,'c:drawer:0:facade')!,/вкладной/);
  assert.match(cornerHandleBlock(main,'c:door:0')!,/второй фасад/);
  assert.equal(cornerHandleBlock(main,'c:door:1'),undefined);
  assert.match(cornerHandleBlock(upper,'c:door:1')!,/антресоли/);
  assert.equal(cornerHandleBlock({} as never,'s1:drawer:0:facade'),undefined);
});

test('критик 01.11: стрелки колонки — только с той стороны, где скрыто',()=>{
  assert.equal(moreState(0,400,400),'');
  assert.equal(moreState(0,300,400),'below');
  assert.equal(moreState(40,300,400),'above below');
  assert.equal(moreState(100,300,400),'above');
});
