import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saveProductionFile,ORDER_REQUIRED} from '../src/exports';
import {downloadReviewArchive} from '../src/reviewPackage';
import {newProject} from '../src/project';
import {restoredStage} from '../src/stages';

// T3 (туториалы 18.10.2026): «Деталировка CSV» скачивалась без номера заказа, хотя ZIP и карты были закрыты.
test('T3: без номера заказа производственные выгрузки не формируются — одинаково для всех',async()=>{
  const p=newProject();let built=0;
  assert.equal(saveProductionFile(p,'Деталировка.csv',()=>{built++;return 'x';}),false);
  assert.equal(saveProductionFile({...p,measurement:{number:'   ',date:'',notes:''}},'Карты листов.html',()=>{built++;return 'x';}),false,'пробелы — не номер');
  assert.equal(built,0,'документ даже не собирается');
  await assert.rejects(downloadReviewArchive(p,true),new RegExp(ORDER_REQUIRED));
});

test('T3: кнопки производственных выгрузок закрыты без номера и идут через saveProductionFile',()=>{
  const src=(f:string)=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
  const out=src('OutputPanel.tsx'),dr=src('DrawingsPanel.tsx');
  for(const name of ['Карты листов.html','Деталировка.csv','Ведомость проекта.html','Бирки деталей.html']){
    assert.ok(new RegExp(`saveProductionFile\\(\\s*project,\\s*['"]${name.replace('.','\\.')}`).test(out),name);
    assert.ok(!new RegExp(`saveFile\\(\\s*['"]${name.replace('.','\\.')}`).test(out),name+' — не в обход проверки');
  }
  assert.match(dr,/disabled=\{!order\} onClick=\{\(\)=>saveProductionFile\(project,'Размерные виды модулей\.html'/);
  // каждая кнопка, сохраняющая производственный файл, заблокирована без номера
  const calls=[...out.matchAll(/saveProductionFile\(/g)].map(m=>m.index!).filter(i=>!out.slice(i-8,i).includes('import')&&out.slice(Math.max(0,i-200),i).includes('onClick'));
  assert.equal(calls.length,4,'карты, CSV, ведомость, бирки');
  for(const i of calls){const before=out.slice(0,i),button=before.slice(before.lastIndexOf('<button'));assert.match(button,/disabled=\{!order\}/,button.slice(0,120));}
  assert.match(out,/disabled=\{packing\|\|!order\}/,'ZIP');
});

// T1 (туториалы 18.10.2026): после первого шкафа редактор возвращался на «Помещение»; после F5 этап сбрасывался.
test('T1: этап при открытии — пустой проект «Помещение», с мебелью — сохранённый этап',()=>{
  assert.equal(restoredStage(false,'bodies'),'room');
  assert.equal(restoredStage(true,'bodies'),'bodies');
  assert.equal(restoredStage(true,'filling'),'bodies','старые этапы сводятся к «Построению мебели»');
  assert.equal(restoredStage(true,'docs'),'docs');
  assert.equal(restoredStage(true,null),'room','первый вход — «Помещение» (решение 14.10)');
  assert.equal(restoredStage(true,'мусор'),'room');
  const empty=readFileSync(new URL('../src/EmptyRoomView.tsx',import.meta.url),'utf8');
  assert.match(empty,/rememberStage\('bodies'\)/,'первая мебель из пустой комнаты открывает «Построение мебели»');
  const palette=readFileSync(new URL('../src/ModulePalette.tsx',import.meta.url),'utf8');
  assert.match(palette,/sessionStorage\.setItem\(PALETTE_KEY/,'категория палитры переживает пересоздание редактора');
});
