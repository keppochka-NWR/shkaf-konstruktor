// Ревью ветки 31.10 (интерфейс): (5) группа «Стоимости» без единой строки с ценой показывала «0 ₽» вместо значка;
// (6) подсказка «Наполнение правится у выбранного…» выводилась трижды (Полки, Ящики, Секция) с одним data-testid.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {groupBadge,breakdownText,breakdownHTML,type Breakdown,type BreakdownGroup,type BreakdownRow} from '../src/estimateBreakdown';
import {SettingsTree} from '../src/SettingsTree';

const row=(id:string,status:BreakdownRow['status'],amount:number|null=null):BreakdownRow=>({id,label:'Позиция '+id,qty:1,unit:'шт.',price:amount,amount,status});
const group=(id:BreakdownGroup['id'],rows:BreakdownRow[]):BreakdownGroup=>({id,title:'Группа '+id,rows,total:rows.reduce((s,r)=>s+(r.amount??0),0),inSheet:rows.filter(r=>r.status==='in-sheet').length,pending:rows.filter(r=>r.status==='pending').length,missing:rows.filter(r=>r.status==='missing').length});

test('(5) группа без строк с ценой — значок, а не «0 ₽»: все после расчёта, все в цене листов, вперемешку',()=>{
  assert.equal(groupBadge(group('light',[row('a','pending'),row('b','pending')])),'pending');
  assert.equal(groupBadge(group('hardware',[row('a','in-sheet'),row('b','in-sheet')])),'in-sheet');
  assert.equal(groupBadge(group('hardware',[row('a','in-sheet'),row('b','pending')])),'pending','нет цены ни у одной, есть «после расчёта»');
  assert.equal(groupBadge(group('hardware',[row('a','missing')])),'missing');
  assert.equal(groupBadge(group('hardware',[row('a','pending'),row('b','priced',500)])),null,'есть цена — сумма');
  const b:Breakdown={groups:[group('sheets',[row('s','priced',23000)]),group('light',[row('l','pending')])],sheetPrice:23000,ldspSheets:1,hdfSheets:0,sum:23000,rounding:0,total:null,pending:1,missing:0};
  const txt=breakdownText(b);
  assert.match(txt,/Группа light: после финального расчёта/);assert.doesNotMatch(txt,/Группа light: 0 ₽/);
  const html=breakdownHTML(b);
  assert.match(html,/Группа light<\/th><th>после финального расчёта<\/th>/);assert.doesNotMatch(html,/Группа light<\/th><th>0 ₽/);
  // панель «Стоимость» — та же функция (не своё условие «total===0 && все в цене листов»)
  const src=readFileSync(new URL('../src/SalesSummary.tsx',import.meta.url),'utf8');
  assert.match(src,/groupBadge\(g\)/);assert.doesNotMatch(src,/g\.total===0/);
});

test('(6) подсказка группового наполнения — один раз, в начале категории «Наполнение»',()=>{
  const hint=createElement('p',{'data-testid':'group-fill-hint'},'Наполнение правится у выбранного');
  const children=[createElement('div',{title:'Габариты',key:1},'g'),createElement('div',{title:'Полки',key:2},'p'),createElement('div',{title:'Ящики',key:3},'d'),createElement('div',{title:'Секция',key:4},'s')];
  const html=renderToStaticMarkup(createElement(SettingsTree,{leads:{'Наполнение':hint},children}));
  assert.equal(html.split('data-testid="group-fill-hint"').length-1,1);
  assert.match(html,/data-settings-category="Наполнение"><summary>.*?<\/summary><div class="settings-subsections"><p data-testid="group-fill-hint">/);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.equal(app.split('{groupFillNote}').length-1,0,'в разделах Полки/Ящики/Секция её больше нет');
  assert.match(app,/leads=\{\{"Наполнение":groupFillNote\}\}/);
});
