// Раскладка экрана (Макс 31.10.2026): клавиша P — «План», меню правой кнопки не заходит на колонку быстрых действий слева,
// иконки видов — все шесть с клавишами в подсказке.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planShortcut,viewShortcut} from '../src/historyShortcuts';
import {menuArea} from '../src/contextMenu';
import {VIEW_BUTTONS} from '../src/SceneToolbar';

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

test('верхняя полоса: шесть видов (3D, спереди, слева, сбоку, сверху, план), у каждого своя клавиша',()=>{
  assert.deepEqual(VIEW_BUTTONS.map(v=>v.label),['3D','Спереди','Слева','Сбоку','Сверху','План']);
  assert.equal(new Set(VIEW_BUTTONS.map(v=>v.key)).size,6);
});
