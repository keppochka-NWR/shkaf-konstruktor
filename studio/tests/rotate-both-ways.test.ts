// Решение Макса 29.10.2026: «поворот модуля у нас работает только в одну сторону» — поворот на 90° в обе стороны
// (кнопки, круговое меню, R / Shift+R, группа). Ветка claude/rotate-group-facades.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,bounds,type Project,type PlacedModule} from '../src/project';
import {initialModule} from '../src/model';
import {createModule} from '../src/ModulePalette';
import {turnModule,turnedRotation,rotateModuleGroup,rotateModule} from '../src/operations';
import {rotateShortcut} from '../src/historyShortcuts';

const room={width:6000,depth:4000};
function project(mods:PlacedModule[]):Project{const p=newProject();return {...p,room:{...p.room,...room},modules:mods};}
const wardrobe=(id:string,x:number,z:number,width=800):PlacedModule=>({id,x,z,y:0,rotation:0,module:{...initialModule(),width,depth:600}});
const inside=(p:Project)=>p.modules.every(a=>{const b=bounds(a);return b.x>=-0.01&&b.z>=-0.01&&b.x+b.w<=p.room.width+0.01&&b.z+b.d<=p.room.depth+0.01;});
const pos=(p:Project,id:string)=>{const a=p.modules.find(x=>x.id===id)!;return {x:Math.round(a.x),z:Math.round(a.z),r:(((a.rotation??0)%360)+360)%360};};

test('turnedRotation: по часовой −90°, против +90° (как прежняя кнопка), всегда 0…359',()=>{
  assert.equal(turnedRotation(0,'ccw'),90);
  assert.equal(turnedRotation(0,'cw'),270);
  assert.equal(turnedRotation(270,'ccw'),0);
  assert.equal(turnedRotation(90,'cw'),0);
  assert.equal(turnedRotation(-90,'cw'),180);
  assert.equal(turnedRotation(undefined,'cw'),270);
});

test('корпус в центре: ↻ потом ↺ — вернулся на место; ↻ — другой поворот, чем ↺',()=>{
  const p=project([wardrobe('a',2000,1500)]);
  const cw=turnModule(p,'a','cw'),ccw=turnModule(p,'a','ccw');
  assert.equal(pos(cw,'a').r,270);assert.equal(pos(ccw,'a').r,90);
  assert.deepEqual(pos(turnModule(cw,'a','ccw'),'a'),pos(p,'a'));
  assert.deepEqual(pos(turnModule(ccw,'a','cw'),'a'),pos(p,'a'));
  // габарит после поворота в обе стороны одинаковый (поворот вокруг центра)
  assert.deepEqual(bounds(cw.modules[0]),bounds(ccw.modules[0]));
  // ↻ = три раза ↺
  const three=turnModule(turnModule(turnModule(p,'a','ccw'),'a','ccw'),'a','ccw');
  assert.deepEqual(pos(three,'a'),pos(cw,'a'));
});

test('у стены и в углу: поворот в любую сторону оставляет корпус в комнате (сдвиг внутрь, как прежний поворот)',()=>{
  for(const [x,z] of [[0,0],[room.width-800,0],[0,room.depth-600],[room.width-800,room.depth-600]]){
    const p=project([wardrobe('a',x,z)]);
    for(const dir of ['cw','ccw'] as const){
      const n=turnModule(p,'a',dir);assert.ok(inside(n),`угол ${x},${z}, ${dir}`);
      // то же, что прежняя функция поворота с явным углом
      assert.deepEqual(n.modules[0],rotateModule(p,'a',dir==='cw'?270:90).modules[0]);
    }
  }
});

test('угловой шкаф: поворот в обе стороны по тем же правилам (в комнате, ↻↺ — на месте)',()=>{
  const corner:PlacedModule={id:'c',x:2000,z:1500,y:0,rotation:0,module:createModule('corner',1050,2000,450,initialModule())};
  const p=project([corner]);
  for(const dir of ['cw','ccw'] as const){const n=turnModule(p,'c',dir);assert.ok(inside(n));}
  assert.deepEqual(pos(turnModule(turnModule(p,'c','cw'),'c','ccw'),'c'),pos(p,'c'));
});

test('группа: ↻ и ↺ — стыки сохраняются, ↻ потом ↺ — группа на месте, у стены сдвигается внутрь',()=>{
  const p=project([wardrobe('a',2000,1500),wardrobe('b',2800,1500)]);
  const cw=rotateModuleGroup(p,['a','b'],'cw'),ccw=rotateModuleGroup(p,['a','b'],'ccw');
  assert.equal(pos(cw,'a').r,270);assert.equal(pos(ccw,'a').r,90);
  // стык: у повёрнутой по часовой группы корпуса стоят вплотную по оси z (одна линия фасадов)
  for(const n of [cw,ccw]){const [ba,bb]=n.modules.map(bounds);assert.equal(Math.round(ba.x),Math.round(bb.x));assert.equal(Math.round(Math.abs(ba.z-bb.z)),800);}
  // по часовой «a» (была левой) уходит вверх (к задней стене), против часовой — вниз
  assert.ok(bounds(cw.modules[0]).z<bounds(cw.modules[1]).z,'↻: левый корпус — ближе к задней стене');
  assert.ok(bounds(ccw.modules[0]).z>bounds(ccw.modules[1]).z,'↺: левый корпус — ближе к передней стене');
  assert.deepEqual(['a','b'].map(id=>pos(rotateModuleGroup(cw,['a','b'],'ccw'),id)),['a','b'].map(id=>pos(p,id)));
  const wall=project([wardrobe('a',0,0),wardrobe('b',800,0)]);
  for(const dir of ['cw','ccw'] as const)assert.ok(inside(rotateModuleGroup(wall,['a','b'],dir)));
  // по умолчанию — как прежняя кнопка «Повернуть группу на 90°» (против часовой)
  assert.deepEqual(rotateModuleGroup(p,['a','b']),ccw);
});

test('клавиши: R — по часовой, Shift+R — против; с Ctrl/Alt, автоповтором и в списке — нет',()=>{
  const key=(o:Partial<KeyboardEvent>)=>({code:'KeyR',key:'r',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,target:null,...o}) as KeyboardEvent;
  assert.equal(rotateShortcut(key({})),'cw');
  assert.equal(rotateShortcut(key({shiftKey:true,key:'R'})),'ccw');
  assert.equal(rotateShortcut(key({key:'к'})),'cw','русская раскладка — та же физическая клавиша');
  assert.equal(rotateShortcut(key({ctrlKey:true})),null,'Ctrl+R — перезагрузка браузера, не поворот');
  assert.equal(rotateShortcut(key({altKey:true})),null);
  assert.equal(rotateShortcut(key({repeat:true})),null);
  assert.equal(rotateShortcut(key({code:'KeyT'})),null);
});
