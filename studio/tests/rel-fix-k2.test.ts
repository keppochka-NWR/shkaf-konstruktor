// K2 (критик релиза 22.10, раунд 2): пеналы, комод, угловой шкаф при занятом ряде у стены вставали посреди комнаты без предупреждения;
// стиральная машина (объект замера) вставала внутрь нижних модулей.
import test from 'node:test';
import assert from 'node:assert/strict';
import {atWall,offWallNote,freeObstacleSpot,OFF_WALL_NOTE} from '../src/freeSpot';
import {newProject,appendModule,applyAutoFillers,bounds,overlap,obstacleBounds,projectErrors,type Project,type RoomObstacle} from '../src/project';
import {initialModule,section} from '../src/model';
import {createKitchenRow} from '../src/ModulePalette';
import {placeKitchenModule,kitchenTemplate} from '../src/kitchenProject';

const room=(width:number,depth=3000)=>({...newProject().room,width,depth,height:2700});
/** три нижних по 600 тем же путём, что палитра (placeKitchenModule): в комнате 2400 ряд занят до стены (справа 579 < 600 + фальш),
 *  в комнате 4000 — место в ряду есть */
function bases(width:number):Project{let p:Project={...newProject(),room:room(width),modules:[]};for(let i=0;i<3;i++)p=applyAutoFillers(placeKitchenModule(p,kitchenTemplate('base-doors',600,initialModule())).project);return p;}
const fullKitchen=()=>bases(2400),emptyKitchen=()=>bases(4000);

test('K2: модуль у задней стены — у стены; перед рядом — нет; столешница — всегда у стены',()=>{
  const p=newProject();const a=p.modules[0];
  assert.equal(atWall(p.room,a),true);
  assert.equal(atWall(p.room,{...a,z:700}),false);
  assert.equal(offWallNote({...p,modules:[{...a,z:700}]},[a.id])?.startsWith('Нет места у стены — модуль «'),true);
  assert.equal(offWallNote(p,[a.id]),null);
});

test('K2: пенал при занятом ряде — в свободное место (без пересечений) и с предупреждением; при свободном ряде — у стены без предупреждения',()=>{
  // четвёртый нижний при занятом ряде тоже встаёт перед рядом — теперь с предупреждением
  {const p=fullKitchen(),r=placeKitchenModule(p,kitchenTemplate('base-doors',600,initialModule()));assert.ok(offWallNote(r.project,[r.id]),'нижний перед рядом — предупреждение');}
  for(const kind of ['tall-oven','tall-fridge','tall'] as const){
    const p=fullKitchen(),r=placeKitchenModule(p,kitchenTemplate(kind,600,initialModule()));
    const a=r.project.modules.find(x=>x.id===r.id)!;
    assert.deepEqual(projectErrors(applyAutoFillers(r.project)),[],kind+': без пересечений');
    for(const o of r.project.modules)if(o.id!==a.id)assert.ok(!overlap(bounds(a),bounds(o)),kind+': не внутри «'+o.module.name+'»');
    const note=offWallNote(r.project,[r.id]);
    assert.ok(note&&note.includes(OFF_WALL_NOTE.split('—')[0].trim()),kind+': предупреждение «Нет места у стены»');
    const q=emptyKitchen(),s=placeKitchenModule(q,kitchenTemplate(kind,600,initialModule()));
    assert.equal(offWallNote(s.project,[s.id]),null,kind+': есть место в ряду — у стены, без предупреждения');
  }
});

test('K2: комод из палитры при занятой задней стене — предупреждение; при свободной — нет',()=>{
  const komod={...initialModule(),width:600,height:850,depth:550,sections:[{...section(),drawers:3}]};
  const full:Project={...newProject(),room:room(2400),modules:[{id:'w1',x:0,y:0,z:30,rotation:0,module:{...initialModule(),width:1200,height:2400,depth:550}},{id:'w2',x:1221,y:0,z:30,rotation:0,module:{...initialModule(),width:1158,height:2400,depth:550}}]};
  const n=appendModule(full,komod),added=n.modules.at(-1)!;
  assert.ok(offWallNote(n,[added.id]),'ряд занят — модуль не у стены, предупреждение');
  const free:Project={...newProject(),room:room(4000),modules:[full.modules[0]]};
  const m=appendModule(free,komod);
  assert.equal(offWallNote(m,[m.modules.at(-1)!.id]),null);
});

test('K2: стиральная машина — свободное место у стены, не внутрь мебели',()=>{
  const p=fullKitchen(),r=p.room;
  const washer:RoomObstacle={id:'o1',type:'washer',name:'Стиральная машина',x:Math.round((r.width-600)/2),z:0,y:0,width:600,depth:600,height:850};
  const spot=freeObstacleSpot(r,p.modules,washer),box=obstacleBounds({...washer,...spot});
  for(const a of p.modules)assert.ok(!overlap(box,bounds(a)),'не внутри «'+a.module.name+'»');
  assert.ok(spot.x===0||spot.x===r.width-600||spot.z===0||spot.z===r.depth-600,'у стены: '+JSON.stringify(spot));
  // пустая комната — у задней стены посередине, как раньше
  const e=newProject();e.modules=[];e.room=room(4000);
  assert.deepEqual(freeObstacleSpot(e.room,[],washer),{x:1700,z:0});
  // вытяжка и варочная панель — по-старому (над мебелью/в столешнице)
  assert.deepEqual(freeObstacleSpot(r,p.modules,{...washer,type:'hob',y:820,height:40}),{x:washer.x,z:0});
  // под навесными у задней стены свободно (навесные на высоте) — машина встаёт туда, если низ свободен
  const walls:Project={...newProject(),room:room(4000),modules:[]};
  walls.modules=createKitchenRow(2400,initialModule()).filter(a=>a.module.kitchen?.role==='wall');
  if(walls.modules.length){const s=freeObstacleSpot(walls.room,walls.modules,washer);assert.equal(s.z,0,'под навесными — у задней стены');}
});
