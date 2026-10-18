import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,parseModule,validate,hasHandles,RULES} from '../src/model';
import {partCollisions} from '../src/collisions';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {kitchenBase} from '../src/kitchen';
import {layoutKitchenDrawers,setKitchenDrawerCount} from '../src/kitchenEditing';
import {setKitchenGola} from '../src/kitchenEditing';

// Решение Макса 16.10.2026: «Зазор между ящиками 30 мм» в выборе ручки ящика — ручки нет, короб ниже на 30 мм,
// фасад выше короба не менее чем на 30 мм (хват сверху за фасад); для всех ящиков секции.
const pick=(ps:ReturnType<typeof parts>,re:RegExp)=>ps.filter(p=>re.test(p.id));
const lo=(p:{position:number[];size:number[]})=>p.position[1]-p.size[1]/2,hi=(p:{position:number[];size:number[]})=>p.position[1]+p.size[1]/2;
for(const doors of [false,true])test(`ящики «зазор 30 мм» (${doors?'за дверью':'открытый корпус'}): между фасадами 30, фасады ниже, верх короба ≤ верх фасада − 30, ручек нет`,()=>{
  const plain=initialModule();plain.doors=doors;
  const grip=structuredClone(plain);grip.sections[0].drawerGrip=true;
  assert.deepEqual(validate(grip),[]);
  const a=parts(plain),b=parts(grip),s=grip.sections[0].id;
  // уточнение Макса 16.10: зазор между фасадами виден — 30 мм; низ нижнего фасада на месте, над верхним — 30 до полки над ящиками
  const fa=pick(a,/:drawer:\d+:facade$/),fb=pick(b,/:drawer:\d+:facade$/),cap=b.find(p=>p.id===`${s}:drawer-cap`)!;
  assert.deepEqual(fb.map(lo),fa.map(lo),'низ каждого фасада на месте');
  const gap0=lo(fa[1])-hi(fa[0]);assert.equal(fb[1].size[1],fa[1].size[1]-(RULES.drawerGrip-gap0),`фасад ниже: зазор 30 вместо ${gap0}`);
  assert.equal(lo(fb[1])-hi(fb[0]),RULES.drawerGrip,'между фасадами ящиков 30 мм');
  assert.equal(lo(cap)-hi(fb[1]),RULES.drawerGrip,'над верхним фасадом 30 мм до полки над ящиками');
  assert.deepEqual(fb.map(p=>p.size[0]),fa.map(p=>p.size[0]),'ширина фасадов та же');
  for(let j=0;j<2;j++){
    const side0=a.find(p=>p.id===`${s}:drawer:${j}:left`)!,side1=b.find(p=>p.id===`${s}:drawer:${j}:left`)!;
    assert.ok(side0.size[1]-side1.size[1]>=RULES.drawerGrip,'боковина короба ниже не менее чем на 30');
    assert.equal(lo(side1),lo(side0),'низ короба на месте');
    for(const k of ['front','back'])assert.equal(b.find(p=>p.id===`${s}:drawer:${j}:${k}`)!.size[1],side1.size[1]);
    const face=fb[j];
    assert.ok(hi(face)-hi(side1)>=30-0.01,'верх короба ниже верха своего фасада не менее чем на 30');
    const sl1=b.find(p=>p.id===`${s}:drawer:${j}:slide:0`)!;
    assert.equal(sl1.position[1],side1.position[1],'направляющая по центру нового короба');
  }
  assert.equal(pick(b,/:drawer:\d+:handle$/).length,0,'ручек ящиков нет');
  assert.equal(pick(a,/:drawer:\d+:handle$/).length,2);
  if(!doors)assert.equal(hasHandles(grip),false);
  assert.deepEqual(partCollisions(b,grip),[]);
  // смета: ручек ящиков нет, направляющие те же
  const ea=estimate(newProject(plain)),eb=estimate(newProject(grip));
  const handles=(e:typeof ea)=>e.lines.filter(l=>l.id.startsWith('handle:')).reduce((n,l)=>n+l.quantity,0);
  assert.equal(handles(ea)-handles(eb),2);
  assert.deepEqual(eb.lines.filter(l=>l.id.startsWith('slide:')),ea.lines.filter(l=>l.id.startsWith('slide:')));
  // сохраняется в файле
  assert.equal(parseModule(JSON.parse(JSON.stringify(grip))).sections[0].drawerGrip,true);
});

test('зазор 30 мм: короб ниже 60 мм — ошибка проверки; без выбора — шкафы без изменений',()=>{
  const m=initialModule();m.doors=false;m.sections[0].drawerGrip=true;
  m.sections[0].drawerConfigs=[{slide:'ball',height:80,length:500},{slide:'ball',height:140,length:500}];
  assert.ok(validate(m).some(e=>/короб ниже 60/.test(e)));
  const plain=initialModule();assert.deepEqual(parts(plain),parts(parseModule(JSON.parse(JSON.stringify(plain)))));
});

// Решение Макса 18.10.2026: на кухне «Зазора между ящиками 30 мм» нет — без ручек на кухне профиль Gola; зазор 30 мм только у шкафов.
test('кухня: зазора 30 мм нет — старый проект с kdrawerGrip открывается без ошибки, поле теряется, ящики как без зазора',()=>{
  for(const sys of ['axis-pro','firmax-ldsp','versalite-h45'] as const){
    const m=kitchenBase(initialModule(),600);m.height=850;setKitchenDrawerCount(m,3);m.kdrawers=layoutKitchenDrawers(m,3,undefined,sys);
    m.kitchen!.handle={dy:31.5,from:'top',horizontal:true,name:'Ручка 128'} as any;
    const old=parseModule({...JSON.parse(JSON.stringify(m)),kdrawerGrip:true});
    assert.equal('kdrawerGrip' in old,false,sys+': поле kdrawerGrip не сохраняется');
    assert.deepEqual(validate(old),[]);
    assert.deepEqual(parts(old),parts(m),sys+': детали те же, что без зазора');
    assert.ok(pick(parts(old),/:drawer:handle$/).length>0,sys+': ручки на фасадах ящиков на месте');
  }
});
test('кухня: без ручек — профиль Gola на ящиках Firmax / Axis PRO / Versalite строится без пересечений',()=>{
  for(const sys of ['axis-pro','firmax-ldsp','versalite-h45'] as const)for(const n of [1,2,3]){
    const m=kitchenBase(initialModule(),600);m.height=850;setKitchenDrawerCount(m,n);m.kdrawers=layoutKitchenDrawers(m,n,undefined,sys);
    setKitchenGola(m,true);
    assert.equal(m.kdrawers![0].system,sys,'система ящиков та же');
    assert.deepEqual(validate(m),[],`${sys} ×${n}`);
    const ps=parts(m);
    assert.deepEqual(partCollisions(ps,m),[],`${sys} ×${n}: 0 пересечений`);
    assert.equal(pick(ps,/handle/).length,0,`${sys} ×${n}: ручек нет`);
    assert.ok(ps.some(p=>/gola/i.test(p.id)),`${sys} ×${n}: профиль Gola в деталях`);
  }
});