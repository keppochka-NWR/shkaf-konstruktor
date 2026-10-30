// Мелкие ошибки из руководства пользователя (30.10.2026). П. 2: первый корпус из палитры пустой комнаты назывался «Модуль 1»,
// следующие из редактора — по виду. Теперь и первый — по виду (и с мансардой).
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject} from '../src/project';
import {createModule,withMansard} from '../src/paletteBuild';
import {appendFromPalette} from '../src/paletteAdd';
import {newModuleName} from '../src/clientLabels';

const empty=()=>{const p=newProject();p.modules=[];return p;};

test('п. 2: первый корпус «Для одежды» в пустой комнате — имя по виду, не «Модуль 1»', () => {
  const p=empty(),m=createModule('wardrobe',800,2200,550,newProject().modules[0].module);
  const next=appendFromPalette(p,m);
  assert.equal(next.modules.length,1);
  assert.equal(next.modules[0].module.name,newModuleName(m.name));
  assert.doesNotMatch(next.modules[0].module.name,/^Модуль \d/);
  assert.match(next.modules[0].module.name,/Для одежды/);
});

test('п. 2: первый корпус с мансардой — имя по виду с пометкой мансарды', () => {
  const p=empty(),src=createModule('empty',800,2200,550,newProject().modules[0].module);
  const m={...withMansard(src,1600),name:src.name+' · мансарда'};
  const next=appendFromPalette(p,m);
  assert.doesNotMatch(next.modules[0].module.name,/^Модуль \d/);
  assert.match(next.modules[0].module.name,/мансарда/);
});
