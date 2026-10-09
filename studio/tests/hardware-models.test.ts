import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import * as THREE from 'three';
import {procKind,procModel,golaModel} from '../src/hardwareModels';
import {parts,initialModule,section,type Module,type Part} from '../src/model';
import {RAFIX_MODEL} from '../src/kitchenRafix';

const bbox=(g:THREE.Object3D)=>{g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());return {s:[s.x,s.y,s.z].map(v=>Math.round(v*100)/100),c:[c.x,c.y,c.z].map(v=>Math.round(v*100)/100)};};
const part=(id:string,name:string,role:Part['role'],size:[number,number,number],material:Part['material']='metal'):Part=>({id,name,role,size,position:[0,0,0],length:size[0],width:size[1],thickness:size[2],material,decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0]});

test('фурнитура без сетки: вид процедурной модели по детали',()=>{
  assert.equal(procKind(part('gola:L:0','Профиль Gola L (верхний), алюминий','fastener',[600,58,27],'alu')),'gola-L');
  assert.equal(procKind(part('gola:C:1','Профиль Gola C (средний), алюминий','fastener',[600,73,27],'alu')),'gola-C');
  assert.equal(procKind(part('raw:r0','Труба Д25','rod',[991,25,25])),'rod-round');
  assert.equal(procKind(part('s:rod','Штанга овальная 15×30','rod',[868,15,30])),'rod-oval');
  assert.equal(procKind(part('s:drawer:0:slide:0','Направляющая · шариковая','drawer',[12,45,500])),'slide-ball');
  assert.equal(procKind(part('kd:0:slide:L','Направляющая скрытого монтажа Firmax 480 левая','drawer',[12,9,470])),'slide-hidden');
  assert.equal(procKind(part('ecc:bottom:left:0','Эксцентрик D15 · бочонок','fastener',[13,15,15])),'ecc-cam');
  assert.equal(procKind(part('ecc:bottom:left:0:pin','Эксцентрик D15 · шток','fastener',[42,7,7])),'ecc-pin');
  assert.equal(procKind(part('dowel:bottom:left:0','Шкант 8×30','fastener',[30,8,8],'board')),'dowel');
  assert.equal(procKind(part('s:latch:0','Толкатель push-to-open','hinge',[14,14,40])),'latch');
  // с моделью (Базис, Blender) — не трогаем; прочие детали — тоже
  assert.equal(procKind({...part('kd:0:slide:L','Axis PRO','drawer',[12,45,500]),model:{file:'hardware/bazis/x.glb',length:'x',native:true}}),undefined);
  assert.equal(procKind(part('left','Боковина','body',[16,720,560],'board')),undefined);
});

test('профиль Gola растягивается по длине без искажения сечения: габарит модели = деталь при любой длине',()=>{
  for(const L of [300,600,1200,2400])for(const [k,h] of [['L',58],['C',73]] as const){
    const b=bbox(golaModel(k,L,h,27));
    assert.deepEqual(b.s,[L,h,27]);assert.deepEqual(b.c,[0,0,0]);
  }
});

test('штанги, направляющие, эксцентрик, шкант: модель вписана в габарит детали и стоит в её центре',()=>{
  const cases:[Part,object?][]=[
    [part('raw:r0','Труба Д25','rod',[991,25,25])],[part('raw:r1','Труба D25 мм','rod',[25,1200,25])],
    [part('s:rod','Штанга овальная 15×30','rod',[868,15,30])],
    [part('s:drawer:0:slide:0','Направляющая · шариковая','drawer',[12,45,450]),{left:true}],[part('s:drawer:0:slide:1','Направляющая · шариковая','drawer',[12,45,450]),{left:false}],
    [part('kd:0:slide:L','Направляющая Firmax','drawer',[12,9,470]),{left:true}],[part('x:drawer:0:slide:1','Направляющая · скрытая','drawer',[20,12,350]),{left:false}],
    [part('ecc:under:left:0','Эксцентрик D15 · бочонок','fastener',[13,15,15])],[part('ecc:top:left:0','Эксцентрик D15 · бочонок','fastener',[15,13,15])],
    [part('ecc:bottom:left:0:pin','Эксцентрик D15 · шток','fastener',[42,7,7]),{headSign:-1}],[part('ecc:x:pin','Эксцентрик D15 · шток','fastener',[7,42,7])],
    [part('dowel:bottom:left:0','Шкант 8×30','fastener',[30,8,8],'board')],[part('dowel:x','Шкант 8×30','fastener',[8,8,30],'board')],
    [part('s:latch:0','Толкатель push-to-open','hinge',[14,14,40])],
  ];
  for(const [p,ctx] of cases){
    const g=procModel(p,ctx as never)!;assert.ok(g,p.id);
    const b=bbox(g);
    b.s.forEach((v,i)=>assert.ok(Math.abs(v-p.size[i])<=0.05,`${p.id} ${p.name}: ${b.s} ≠ ${p.size}`));
    b.c.forEach((v)=>assert.ok(Math.abs(v)<=0.05,`${p.id}: центр ${b.c}`));
  }
});

test('бочонок эксцентрика в горизонтали — ось по нормали пласти (Y), шток — по X к бочонку; в боковине (under) — ось X',()=>{
  const cam=bbox(procModel(part('ecc:bottom:left:0','Эксцентрик D15 · бочонок','fastener',[13,15,15]))!);
  assert.deepEqual(cam.s,[15,13,15]);
  const under=bbox(procModel(part('ecc:bottom-under:left:0','Эксцентрик D15 · бочонок','fastener',[13,15,15]))!);
  assert.deepEqual(under.s,[13,15,15]);
});

test('рафикс кухни: модель Blender (мм) в точке и повороте Базиса у корпуса и штока, файлы есть',()=>{
  const s=section();s.shelves=[0.5];s.fixed=[0];
  const m:Module={...initialModule(),width:600,height:2100,depth:560,sections:[s],kitchen:{role:'tall',rafix:{rear:20,front:60,n:2}}};
  const ps=parts(m),body=ps.filter(p=>p.id.startsWith('rafix:')&&!p.id.endsWith(':pin')),pins=ps.filter(p=>p.id.startsWith('rafix:')&&p.id.endsWith(':pin'));
  assert.equal(body.length,4);assert.equal(pins.length,4);
  for(const p of body){assert.equal(p.model?.file,RAFIX_MODEL.housing);assert.ok(p.model?.native);assert.deepEqual(p.model?.origin,p.anchor);assert.deepEqual(p.model?.quat,p.quat);}
  for(const p of pins){const b=ps.find(q=>q.id===p.id.slice(0,-4))!;assert.equal(p.model?.file,RAFIX_MODEL.pin);assert.deepEqual(p.model?.origin,b.anchor);assert.deepEqual(p.model?.quat,b.quat);}
  for(const f of Object.values(RAFIX_MODEL))assert.ok(existsSync(`public/models/${f}`),f);
});
