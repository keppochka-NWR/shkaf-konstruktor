import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,initialModule,parseModule,validate,hasHandles,RULES} from '../src/model';
import {partCollisions} from '../src/collisions';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {kitchenBase} from '../src/kitchen';
import {layoutKitchenDrawers,setKitchenDrawerCount} from '../src/kitchenEditing';
import {gripKDrawers,kdrawerGripAvailable,axisTop} from '../src/kitchenDrawers';

// Решение Макса 16.10.2026: «Зазор между ящиками 30 мм» в выборе ручки ящика — ручки нет, короб ниже на 30 мм,
// фасад выше короба не менее чем на 30 мм (хват сверху за фасад); для всех ящиков секции.
const pick=(ps:ReturnType<typeof parts>,re:RegExp)=>ps.filter(p=>re.test(p.id));
for(const doors of [false,true])test(`ящики «зазор 30 мм» (${doors?'за дверью':'открытый корпус'}): фасады те же, короб −30, направляющие ниже, ручек нет`,()=>{
  const plain=initialModule();plain.doors=doors;
  const grip=structuredClone(plain);grip.sections[0].drawerGrip=true;
  assert.deepEqual(validate(grip),[]);
  const a=parts(plain),b=parts(grip),s=grip.sections[0].id;
  // фасады ящиков — те же
  assert.deepEqual(pick(b,/:drawer:\d+:facade$/).map(p=>[p.size,p.position]),pick(a,/:drawer:\d+:facade$/).map(p=>[p.size,p.position]));
  for(let j=0;j<2;j++){
    const side0=a.find(p=>p.id===`${s}:drawer:${j}:left`)!,side1=b.find(p=>p.id===`${s}:drawer:${j}:left`)!;
    assert.equal(side1.size[1],side0.size[1]-RULES.drawerGrip,'боковина короба ниже на 30');
    assert.equal(side1.position[1]-side1.size[1]/2,side0.position[1]-side0.size[1]/2,'низ короба на месте');
    for(const k of ['front','back'])assert.equal(b.find(p=>p.id===`${s}:drawer:${j}:${k}`)!.size[1],a.find(p=>p.id===`${s}:drawer:${j}:${k}`)!.size[1]-30);
    const face=b.find(p=>p.id===`${s}:drawer:${j}:facade`)!;
    assert.ok(face.position[1]+face.size[1]/2-(side1.position[1]+side1.size[1]/2)>=30,'фасад выше короба не менее чем на 30');
    const sl0=a.find(p=>p.id===`${s}:drawer:${j}:slide:0`)!,sl1=b.find(p=>p.id===`${s}:drawer:${j}:slide:0`)!;
    assert.equal(sl1.position[1],sl0.position[1]-15,'направляющая по центру нового короба');
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

test('кухонные ящики студии: «зазор 30 мм» — фасады те же, короб ЛДСП −30, Axis PRO на царгу ниже ≥30, ручек нет, 0 пересечений',()=>{
  for(const sys of ['axis-pro','firmax-ldsp','versalite-h45'] as const){
    const m=kitchenBase(initialModule(),600);m.height=850;setKitchenDrawerCount(m,3);m.kdrawers=layoutKitchenDrawers(m,3,undefined,sys);
    m.kitchen!.handle={dy:31.5,from:'top',horizontal:true,name:'Ручка 128'} as any;
    assert.ok(kdrawerGripAvailable(m));
    const g=structuredClone(m);g.kdrawerGrip=true;
    assert.deepEqual(validate(g),[]);
    const a=parts(m),b=parts(g);
    assert.deepEqual(pick(b,/^kd:\d+:facade$/).map(p=>[p.size,p.position]),pick(a,/^kd:\d+:facade$/).map(p=>[p.size,p.position]),sys+': фасады те же');
    const ks=gripKDrawers(g);
    m.kdrawers!.forEach((k,i)=>{const top0=axisTop(k),top1=axisTop(ks[i]);assert.ok(top0-top1>=30-0.01,`${sys} ящик ${i+1}: короб ниже на ${top0-top1}`);assert.ok(k.y1-top1>=30-0.01,'фасад выше короба не менее чем на 30');});
    assert.ok(pick(a,/:drawer:handle$/).length>0,'без зазора ручки есть');
    assert.equal(pick(b,/:drawer:handle$/).length,0,sys+': ручек нет');
    assert.deepEqual(partCollisions(b,g),[],sys);
    // смета: без ручек; у Axis PRO — комплект с новой царгой
    const eb=estimate(newProject(g));assert.ok(!eb.lines.some(l=>/Ручка 128/.test(l.label)));
    if(sys==='axis-pro')assert.ok(eb.lines.some(l=>l.id.startsWith('axis-pro:168:'))&&!eb.lines.some(l=>l.id.startsWith('axis-pro:200:')));
    assert.equal(parseModule(JSON.parse(JSON.stringify(g))).kdrawerGrip,true);
  }
  // модуль «как есть» из Базиса — не применяется
  const raw=kitchenBase(initialModule(),600);setKitchenDrawerCount(raw,2);(raw as any).raw={};assert.equal(kdrawerGripAvailable(raw),false);
});
