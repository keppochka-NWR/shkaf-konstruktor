// Физика расстановки (запросы Макса 31.10.2026): навесные — к стене, шкафы — на полу или на модуле; поворот без места — в ближайшее
// свободное положение; тяга — стоп у стен и соседей, падение со стопки, магнит к стене. Чистые функции src/placement.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,type Module} from '../src/model';
import {newProject,projectErrors,applyAutoFillers,bounds,moduleCenter,parseProject,type PlacedModule,type Project} from '../src/project';
import {supportRole,supportProblem,supportWarnings,backContact,fixSupport,settleDrag,nearestTurn,attachToWall,restsOn,settleAdded,SUPPORT,WALL_TOL} from '../src/placement';
import {turnNear,rotateModuleGroup,rotateGroupNear} from '../src/operations';
import {radiusProjectErrors} from '../src/shapes';
import {radiusShelving} from '../src/paletteBuild';
import {outlinePreset,withOutline} from '../src/roomOutline';
import {roomWarnings} from '../src/roomWarnings';

const box=(name:string,w=600,h=2000,d=550,extra:Partial<Module>={}):Module=>{const m=initialModule();return {...m,name,width:w,height:h,depth:d,sections:m.sections.map(s=>({...s,shelves:[],rod:false})),...extra};};
const place=(id:string,m:Module,x:number,z:number,y=0,rotation=0):PlacedModule=>({id,x,z,y,rotation,module:m});
function room(mods:PlacedModule[],w=4000,d=3000):Project{const p=newProject();p.room={width:w,depth:d,height:2700,openings:[]};p.modules=mods;return p;}

test('опора: роли по типу — шкаф на полу, навесной; поднятый шкаф без флага — шкаф (у стены без замечаний); столешница — не проверяется', () => {
  const p=room([place('a',box('Шкаф'),100,3),place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),1000,3,1400),place('r',box('Поднятый',600,400,300),2000,3,1200),place('k',box('Кухня',600,720,300,{kitchen:{role:'wall'}}),2700,3,1400)]);
  assert.equal(supportRole(p,p.modules[0]),'floor');
  assert.equal(supportRole(p,p.modules[1]),'wall');
  assert.equal(supportRole(p,p.modules[2]),'floor','без флага навесного — шкаф (критик 31.10), к стене сам не тянется');
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
  assert.equal(backContact(p,a)!.edge,diag);assert.ok(backContact(p,a)!.gap<=1);
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

test('тяга: упирается в соседа; шкаф при тяге НЕ разворачивается (критик 31.10), к стене — только сдвигом, если спина смотрит на неё', () => {
  const a=place('a',box('А'),1000,3),b=place('b',box('Б'),2000,3),p=room([a,b]);
  const s=settleDrag(p,'b',{x:1300,y:0,z:3},{view:'top'});assert.equal(s.x,1600,'вплотную к А справа');
  // стол/шкаф у левой стены, тянем на 200 мм — поворот прежний (было: разворот на 90° к левой стене)
  const desk=place('d',box('Стол',1200,750,600),100,1200,0,0),q=room([desk]);
  const m=settleDrag(q,'d',{x:300,y:0,z:1200},{view:'top'});assert.equal(m.rotation,0);assert.equal(m.x,300);assert.equal(m.z,1200);
  // торцевой шкаф ряда поперёк комнаты (боком к задней стене), тянем на 1 мм — ни поворота, ни прыжка
  const side=place('e',box('Торец'),2000,40,0,90),q2=room([side]);
  const e=settleDrag(q2,'e',{x:2001,y:0,z:40},{view:'top'});assert.equal(e.rotation,90);assert.equal(e.x,2001);assert.equal(e.z,40);
  // спина к задней стене, тяга началась вне зоны (z 400), подвели на 100 — встал вплотную, поворот тот же
  const far=place('f',box('Ф'),1500,400),q3=room([far]);
  const f=settleDrag(q3,'f',{x:1500,y:0,z:100},{view:'top'});assert.equal(f.z,3);assert.equal(f.rotation,0);
  // тяга началась в зоне (композиция в 30 мм от стены) — к стене не прижимает
  const near=place('n',box('Н'),1500,30),q4=room([near]);
  assert.equal(settleDrag(q4,'n',{x:1700,y:0,z:30},{view:'top'}).z,30);
  // спина смотрит в комнату (поворот 180) у задней стены — не прижимает и не разворачивает
  const back=place('k',box('К'),1500,300,0,180),q5=room([back]);
  const k=settleDrag(q5,'k',{x:1500,y:0,z:100},{view:'top'});assert.equal(k.rotation,180);assert.equal(k.z,100);
  assert.equal(settleDrag(q3,'f',{x:1500,y:0,z:100},{view:'top',point:true}).z,100,'Alt/Ctrl или линия Q — без прижима');
});

test('опора: композиция в 30 мм от стены — навесной в ряд без замечаний, тяга зазор не съедает (критик 31.10)', () => {
  const base=place('a',box('Шкаф',600,2000,550),300,30),hang=place('h',box('Антресоль',600,500,550,{hanging:true,plinthHeight:0}),300,30,2050);
  const p=room([base,hang]);
  assert.equal(backContact(p,hang)!.gap,27,'z 30 − задник 3');assert.equal(supportProblem(p,hang),null,'в пределах допуска '+WALL_TOL);
  const off=place('o',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),1500,120,1400),q=room([base,off]);
  assert.match(supportProblem(q,off)!,/не у стены: спина в 117 мм/);
  const row=place('r',box('Шкаф2',600,2000,550),2000,120),q2=room([row,{...off,x:2000,y:2050,module:{...off.module,height:500}}]);
  assert.equal(supportProblem(q2,q2.modules[1]),null,'вровень со спиной ряда у стены (117 ≤ 150)');
  const s=settleDrag(p,'h',{x:400,y:2050,z:30},{view:'top'});assert.equal(s.z,30,'тянем вдоль — зазор 30 сохранён');assert.equal(s.x,400);
  // ряд навесных в 30 мм: 1 мм в соседа — обратно на своё место, а не вплотную к стене
  const h1=place('h1',box('Н1',600,700,300,{hanging:true,plinthHeight:0}),1000,30,1400),h2=place('h2',box('Н2',600,700,300,{hanging:true,plinthHeight:0}),1600,30,1400),q3=room([h1,h2]);
  const k=settleDrag(q3,'h2',{x:1599,y:1400,z:30},{view:'top'});assert.equal(k.z,30);assert.equal(k.x,1600);
});

test('тяга навесного: малая тяга не разворачивает, ряд дальше допуска не прижимается, линия Q не сдёргивается (критик 31.10)', () => {
  const hang=(w=600,d=300,h=700)=>box('Н',w,h,d,{hanging:true,plinthHeight:0});
  // стоит боком к задней стене (спина смотрит на левую, далеко): 1 мм — ни поворота, ни прыжка
  const side=place('s',hang(),2000,40,1400,90),q=room([side]);
  const s=settleDrag(q,'s',{x:2001,y:1400,z:40},{view:'top'});assert.equal(s.rotation,90);assert.equal(s.x,2001);assert.equal(s.z,40);
  // узкий глубокий навесной в углу у правой стены: центр ближе к ней, но тяга мала — своя стена, поворот прежний
  const corner=place('c',hang(200,600),3800,3,1400),q2=room([corner]);
  const c=settleDrag(q2,'c',{x:3790,y:1400,z:3},{view:'top'});assert.equal(c.rotation,0);assert.equal(c.z,3);
  // вровень с рядом в 120 мм от стены (дальше допуска 50): тянем вдоль — зазор ряда сохранён
  const row=place('r',box('Шкаф',600,2000,550),2000,120),up=place('u',hang(600,550,500),2000,120,2050),q3=room([row,up]);
  assert.equal(supportProblem(q3,up),null);
  const u=settleDrag(q3,'u',{x:2100,y:2050,z:120},{view:'top'});assert.equal(u.z,120);assert.equal(u.rotation,0);
  // отъехал на 100 мм, спина смотрит на стену: пользователь двигает — прижимается, поворот тот же
  const off=place('o',hang(),2000,100,1400),q4=room([off]);
  const o0=settleDrag(q4,'o',{x:2001,y:1400,z:100},{view:'top'});assert.equal(o0.z,100,'1 мм — не перебрасывает к стене');
  const o=settleDrag(q4,'o',{x:2300,y:1400,z:100},{view:'top'});assert.equal(o.z,3);assert.equal(o.rotation,0);
  // шкаф на линии Q / Alt/Ctrl: сосед не сдёргивает с места, пересечение покажет красный след
  const a=place('a',box('А'),1000,3),b=place('b',box('Б'),2000,3),q5=room([a,b]);
  assert.equal(settleDrag(q5,'b',{x:1300,y:0,z:3},{view:'top',point:true}).x,1300);
  // на 1 мм в соседа, стоя вплотную — на прежнее место, а не на шаг сетки
  const f1=place('f',box('Вплотную'),1600,3),q6=room([a,f1]);assert.equal(settleDrag(q6,'f',{x:1599,y:0,z:3},{view:'top'}).x,1600);
});
test('опора: шкаф студии, поднятый без флага навесного, не у стены — «висит в воздухе», к стене при тяге не тянется', () => {
  const r=place('r',box('Полка',600,400,300),1500,800,1200),p=room([r]);
  assert.equal(supportRole(p,r),'floor');assert.match(supportProblem(p,r)!,/висит в воздухе/);
  const s=settleDrag(p,'r',{x:1600,y:1200,z:800},{view:'top'});assert.equal(s.z,800);assert.equal(s.y,1200,'висел до тяги — высота не меняется');assert.equal(s.rotation,0);
});

test('«Повесить к стене» и поворот берут ближайшее место (запас от соседей — лишь надбавка, критик 31.10)', () => {
  // навесной между двумя навесными, отъехал от стены на 200: ближайшее — вплотную между ними (а не с запасом в 600 мм или на другой стене)
  const L=place('l',box('Л',600,700,300,{hanging:true,plinthHeight:0}),400,3,1400),R=place('r',box('П',600,700,300,{hanging:true,plinthHeight:0}),1600,3,1400);
  const H=place('h',box('Н',600,700,300,{hanging:true,plinthHeight:0}),1000,200,1400),p=room([L,R,H]);
  const n=fixSupport(p,'h').modules[2];assert.equal(n.rotation,0);assert.equal(n.z,3);assert.ok(Math.abs(n.x-1000)<=10,String(n.x));
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

test('поворот группы без места — сдвиг всей группы, сколько сдвинута — в ответе', () => {
  const g1=place('g1',box('Г1'),1500,3),g2=place('g2',box('Г2'),2100,3),wall=place('w',box('Стена',600),2800,3),front=place('f',box('Перед',1200,2000,500),1300,640);
  const p=room([g1,g2,wall,front]);
  const r=rotateGroupNear(p,['g1','g2'],'cw');
  assert.deepEqual(projectErrors(r.project),[]);assert.equal(r.project.modules[0].rotation,270);assert.ok(r.moved>0,String(r.moved));assert.deepEqual(r.loose,[]);
  assert.deepEqual(projectErrors(rotateModuleGroup(p,['g1','g2'],'cw')),[]);
});

test('радиусный шире 600 из старого файла копируется (копия — тот же размер), новый — в пределах', () => {
  const old={...radiusShelving(600,2000,400,initialModule()),width:800,name:'Радиусный'};
  const p=room([place('a',old,0,3)]),copy=room([place('a',old,0,3),place('b',structuredClone(old),900,3)]);
  assert.deepEqual(radiusProjectErrors(p,copy),[]);
  assert.match(radiusProjectErrors(p,room([place('a',old,0,3),place('b',{...old,width:900},900,3)]))[0],/до 600/);
});
test('добавленный навесной встаёт к стене', () => {
  const p=room([place('h',box('Навесной',600,700,300,{hanging:true,plinthHeight:0}),1000,30,1400)]);
  const n=settleAdded(p,'h');assert.equal(supportProblem(n,n.modules[0]),null);assert.equal(n.modules[0].z,3);
});
