// Физика расстановки (запросы Макса 31.10.2026): навесные — к стене, шкафы — на полу или на модуле; поворот без места — в ближайшее
// свободное положение; тяга — стоп у стен и соседей, падение со стопки, магнит к стене. Чистые функции src/placement.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,type Module} from '../src/model';
import {newProject,projectErrors,applyAutoFillers,bounds,moduleCenter,parseProject,type PlacedModule,type Project} from '../src/project';
import {supportRole,supportProblem,supportWarnings,backContact,fixSupport,settleDrag,nearestTurn,attachToWall,restsOn,settleAdded,SUPPORT} from '../src/placement';
import {turnNear,rotateModuleGroup} from '../src/operations';
import {outlinePreset,withOutline} from '../src/roomOutline';
import {roomWarnings} from '../src/roomWarnings';

const box=(name:string,w=600,h=2000,d=550,extra:Partial<Module>={}):Module=>{const m=initialModule();return {...m,name,width:w,height:h,depth:d,sections:m.sections.map(s=>({...s,shelves:[],rod:false})),...extra};};
const place=(id:string,m:Module,x:number,z:number,y=0,rotation=0):PlacedModule=>({id,x,z,y,rotation,module:m});
function room(mods:PlacedModule[],w=4000,d=3000):Project{const p=newProject();p.room={width:w,depth:d,height:2700,openings:[]};p.modules=mods;return p;}

test('опора: роли по типу — шкаф на полу, навесной, поднятый шкаф без флага — навесной, столешница и Базис — не проверяются', () => {
  const p=room([place('a',box('Шкаф'),100,3),place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),1000,3,1400),place('r',box('Поднятый',600,400,300),2000,3,1200),place('k',box('Кухня',600,720,300,{kitchen:{role:'wall'}}),2700,3,1400)]);
  assert.equal(supportRole(p,p.modules[0]),'floor');
  assert.equal(supportRole(p,p.modules[1]),'wall');
  assert.equal(supportRole(p,p.modules[2]),'wall');
  assert.equal(supportRole(p,p.modules[3]),'wall');
  assert.equal(supportRole(p,place('w',box('Столешница',1200,38,600,{worktop:{material:'ldsp',thickness:38}} as Partial<Module>),0,0,850)),null);
  assert.deepEqual(supportWarnings(p),[],'все у стены (z = 3, задник 3) и на полу — предупреждений нет');
});

test('опора: шкаф в воздухе, навесной не у стены — предупреждения; антресоль на шкафу — норма', () => {
  const base=place('a',box('Шкаф'),100,3),upper=place('u',box('Антресоль',600,500,550),100,3,2000);
  const fly=place('f',box('На ножках',600,1800,500,{feet:{height:100}}),1500,800,300);
  const off=place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),2600,400,1400);
  const p=room([base,upper,fly,off]);
  assert.equal(restsOn(p,upper),true);assert.equal(supportProblem(p,upper),null);
  assert.match(supportProblem(p,fly)!,/висит в воздухе: низ на 300 мм/);
  assert.match(supportProblem(p,off)!,/не у стены: спина в 397 мм/);
  assert.equal(roomWarnings(p).filter(w=>w.kind==='support').length,2,'в «Проверьте расстановку»');
  // старый проект с висящим шкафом открывается (правило опоры — не ошибка проекта)
  assert.doesNotThrow(()=>parseProject(JSON.parse(JSON.stringify(p))));
  assert.deepEqual(projectErrors(p),[]);
});

test('опора: «Поставить на пол / к стене» одним щелчком', () => {
  const base=place('a',box('Шкаф',600,1500),100,3),fly=place('f',box('Антресоль',600,500,550,{feet:{height:100}}),100,3,1650);
  const off=place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),2600,400,1400);
  const p=room([base,fly,off]);
  const n1=fixSupport(p,'f');assert.equal(n1.modules[1].y,1500,'на верх шкафа под ним');
  const n2=fixSupport(p,'h'),h=n2.modules[2];assert.equal(supportProblem(n2,h),null);assert.equal(h.y,1400,'высота та же');
  assert.equal(backContact(n2,h)!.gap,0);
  assert.ok(Math.hypot(moduleCenter(h).x-moduleCenter(off).x,moduleCenter(h).z-moduleCenter(off).z)<450,'к ближайшей стене');
});

test('опора: косая стена контура — навесной спиной вплотную, лицом в комнату', () => {
  const p=room([]);p.room=withOutline(p.room,outlinePreset('chamfer',4000,3000));
  const o=p.room.outline!,diag=o.findIndex((q,i)=>{const n=o[(i+1)%o.length];return Math.abs(n.x-q.x)>1&&Math.abs(n.z-q.z)>1;});
  const a=attachToWall(p,place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),0,0,1400),diag,375);
  p.modules=[a];
  assert.equal(backContact(p,a)!.edge,diag);assert.ok(backContact(p,a)!.gap<=SUPPORT.flush);
  assert.equal(a.rotation!%90!==0,true,'повёрнут по скосу');assert.deepEqual(projectErrors(p),[]);assert.equal(supportProblem(p,a),null);
});

test('тяга: шкаф сверху падает со стопки на пол, спереди — ближайший уровень опоры, навесной едет вдоль стены', () => {
  const base=place('a',box('Шкаф',600,1500),100,3),top=place('u',box('Верх',600,500,550),100,3,1500);
  const p=room([base,top]);
  assert.equal(settleDrag(p,'u',{x:1500,y:1500,z:3},{view:'top'}).y,0,'ушёл с шкафа — на пол');
  assert.equal(settleDrag(p,'u',{x:120,y:1500,z:3},{view:'top'}).y,1500,'над шкафом — остаётся на нём');
  assert.equal(settleDrag(p,'u',{x:100,y:1380,z:3},{view:'front'}).y,1500,'спереди — к ближайшей опоре');
  assert.equal(settleDrag(p,'u',{x:100,y:300,z:3},{view:'front'}).y,0);
  const h=place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),2000,3,1400),q=room([h]);
  const s=settleDrag(q,'h',{x:2500,y:1400,z:900},{view:'top'});assert.equal(s.z,3,'спиной к задней стене, хоть курсор ушёл в комнату');assert.equal(s.x,2500);
  const t=settleDrag(q,'h',{x:3500,y:1400,z:1500},{view:'top'});assert.equal(t.rotation,270,'ближе к правой стене — на неё, лицом в комнату');
});

test('тяга: упирается в соседа и стену, магнит к стене разворачивает спиной', () => {
  const a=place('a',box('А'),1000,3),b=place('b',box('Б'),2000,3),p=room([a,b]);
  const s=settleDrag(p,'b',{x:1300,y:0,z:3},{view:'top'});assert.equal(s.x,1600,'вплотную к А справа');
  const c=place('c',box('В',600,2000,550),1500,1200,0,0),q=room([c]);
  const m=settleDrag(q,'c',{x:60,y:0,z:1200},{view:'top'});assert.equal(m.rotation,90,'к левой стене боком — развернулся спиной к ней');
  assert.equal(settleDrag(q,'c',{x:60,y:0,z:1200},{view:'top',point:true}).rotation,0,'Alt/Ctrl — без магнита');
});

test('поворот без места: в ближайшее свободное положение, навесной — к стене; нет места — отказ', () => {
  // узкий проём между двумя шкафами: повёрнутый 800×550 не встаёт на месте — сдвигается к ближайшему свободному
  const a=place('a',box('А'),0,3),m=place('m',box('Средний'),620,3),b=place('b',box('Б'),1240,3),f=place('f',box('Перед',1200,2000,400),300,590);
  const p=room([a,m,f]);void b;
  const r=turnNear(p,'m','ccw'),mm=r.project.modules.find(x=>x.id==='m')!;
  assert.equal(mm.rotation,90);assert.ok(r.moved>0&&r.moved<=SUPPORT.turnRadius);assert.deepEqual(projectErrors(applyAutoFillers(r.project)),[]);
  // навесной у задней стены, повёрнут на 90° — на левую стену, высота та же
  const h=place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),100,3,1400),q=room([h]);
  const t=turnNear(q,'h','ccw').project.modules[0];assert.equal(t.rotation,90);assert.equal(supportProblem(q,t),null);assert.equal(Math.round(bounds(t).x),0);
  // тесная комната — некуда
  const tight=room([place('x',box('Широкий',1900,2000,550),0,3)],1900,700);
  assert.throws(()=>nearestTurn(tight,'x',90),/Повернуть «Широкий» некуда/);
});

test('поворот группы без места — сдвиг всей группы', () => {
  const g1=place('g1',box('Г1'),1500,3),g2=place('g2',box('Г2'),2100,3),wall=place('w',box('Стена',600),2800,3);
  const p=room([g1,g2,wall]);
  const n=rotateModuleGroup(p,['g1','g2'],'cw');
  assert.deepEqual(projectErrors(n),[]);assert.equal(n.modules[0].rotation,270);
});

test('добавленный навесной встаёт к стене', () => {
  const p=room([place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),1000,30,1400)]);
  const n=settleAdded(p,'h');assert.equal(supportProblem(n,n.modules[0]),null);assert.equal(n.modules[0].z,3);
});
