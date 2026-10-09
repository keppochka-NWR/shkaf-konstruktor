import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {axisLayout,axisFits,axisTop,axisCeiling,relayoutKDrawers,refitKDrawers} from '../src/kitchenDrawers';
import {edgeByDir} from '../src/edges';

// НМ 600 с тремя ящиками Axis PRO как в Базисе k06/m03 (2×H-86 + H-168, 500 мм)
const axis=()=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=[{system:'axis-pro',y0:629.5,y1:787,runnerY:694,h:86,len:500},{system:'axis-pro',y0:469,y1:626.5,runnerY:543,h:86,len:500},{system:'axis-pro',y0:101.5,y1:439,runnerY:174,h:168,len:500}];return m;};

test('Axis PRO drawer: LDSP bottom and back follow the runner like Bazis (37.5 / 43.5 from the sides, 22 below the runner)',()=>{
  const m=axis(),ps=parts(m),b=ps.find(p=>p.id==='kd:0:bottom')!,k=ps.find(p=>p.id==='kd:0:back')!,F=ps.find(p=>p.id==='left')!;
  const front=F.position[2]+F.size[2]/2;
  assert.equal(b.size[0],600-32-75);assert.equal(b.size[2],476);assert.equal(b.position[1]-8,672);
  assert.equal(k.size[0],600-32-87);assert.equal(k.size[1],84);assert.equal(Math.round(k.position[2]+8),Math.round(front-476));
  assert.equal(ps.find(p=>p.id==='kd:2:back')!.size[1],167,'H-168 back 167');
  assert.deepEqual(validate(m),[]);
});

test('Axis PRO hardware: 6 system parts, 2 caps, 2 runners per drawer; Bazis meshes; no unallowed collisions',()=>{
  const m=axis(),ps=parts(m);
  for(const j of [0,1,2]){
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:sys:`)).length,6);
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:cap:`)).length,2);
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:slide:`)).length,2);
  }
  assert.equal(ps.find(p=>p.id==='kd:0:slide:L')!.model!.file,'hardware/bazis/d50b3f8e4044.glb');
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('Axis PRO drilling: runner D5x2.1 x4 + D3x3 x2 per side, rear holder D5x1+D3x3, facade D3.5x4.5 (AB 2, CD 4)',()=>{
  const m=axis(),h=holes(m);
  const side=h.filter(x=>x.part==='left'&&x.d===5&&x.depth===2.1);assert.equal(side.length,12);
  assert.equal(h.filter(x=>x.part==='kd:2:back'&&x.d===5&&x.depth===1).length,6,'H-168: 3 per holder');
  assert.equal(h.filter(x=>x.part==='kd:2:facade'&&x.d===3.5).length,8,'CD: 4 per side');
  assert.equal(h.filter(x=>x.part==='kd:0:facade'&&x.d===3.5).length,4,'AB: 2 per side');
});

test('kdrawers survive save/load and bad input is rejected',()=>{
  const m=axis(),back=parseModule(JSON.parse(JSON.stringify(m)))!;
  assert.deepEqual(back.kdrawers,m.kdrawers);
  const bad={...m,kdrawers:[{...m.kdrawers![0],h:99 as never},{...m.kdrawers![1],y1:700}]};
  const e=validate(bad);
  assert.ok(e.some(x=>/высота царги/.test(x)));assert.ok(e.some(x=>/пересекается/.test(x)));
});
test('critic r1: right runner box sits on its mesh (z F-497..F-7), not 504 mm in front of the cabinet',()=>{
  const m=axis(),ps=parts(m),L=ps.find(p=>p.id==='left')!,F=L.position[2]+L.size[2]/2;
  for(const lr of ['L','R']){const r=ps.find(p=>p.id==='kd:2:slide:'+lr)!;
    assert.ok(Math.abs(r.position[2]+r.size[2]/2-(F-7))<0.01&&Math.abs(r.position[2]-r.size[2]/2-(F-497))<0.01,lr+' runner z '+(r.position[2]-r.size[2]/2)+'..'+(r.position[2]+r.size[2]/2));}
  const cd=ps.find(p=>p.id==='kd:2:sys:front:L')!;assert.ok(Math.abs(cd.position[1]+cd.size[1]/2-(174+3.5+132))<0.01,'CD front holder height from its mesh');
});

test('critic r1: default layout never pushes a drawer into the cabinet rails (600–1100, 1–3 drawers); 4 drawers that cannot fit are rejected, not drawn',()=>{
  for(let n=1;n<=4;n++)for(let H=600;H<=1100;H+=5){
    const m=kitchenBase(initialModule(),600,'drawers' as never);m.height=H;m.kdrawers=axisLayout(m,n);
    const fits=m.kdrawers.every(k=>axisFits(m,k)),e=validate(m),c=partCollisions(parts(m),m);
    if(fits){assert.deepEqual(e,[],`${n}×${H}`);assert.deepEqual(c,[],`${n}×${H}`);assert.ok(m.kdrawers.every(k=>axisTop(k)<=axisCeiling(m)-5),`${n}×${H}`);}
    // не по запасам раскладки (низкий корпус): либо отказ проверкой, либо физически без пересечений
    else{assert.ok(n===4||H<800,`${n}×${H} must fit`);if(c.length)assert.ok(e.some(x=>/царги корпуса|направляющую ящика выше/.test(x)),`${n}×${H} rejected`);}
  }
});

test('critic r1: Axis PRO runner may only touch its cabinet side — a runner sunk into the bottom is reported',()=>{
  const m=axis();m.kdrawers![2]={...m.kdrawers![2],runnerY:150};
  assert.ok(validate(m).some(x=>/уходит в дно/.test(x)));
  assert.ok(partCollisions(parts(m),m).some(c=>/Направляющая Axis PRO/.test(c.names.join(' '))&&/Дно/.test(c.names.join(' '))));
});
test('critic r3: bottom 400×557 under the sides — edges on the front and both 557 sides in 3D AND in the length/width convention of estimate and labels',()=>{
  const m=axis();m.width=400;m.edgeScheme={t:0.5};m.kdrawers=axisLayout(m,3);
  const b=parts(m).find(p=>p.id==='bottom')!;
  assert.deepEqual(Object.keys(edgeByDir(b)).sort(),['+x','+z','-x']);
  const byConvention=b.edge.reduce((s,e,k)=>s+(e>0?(k<2?b.width:b.length):0),0);
  assert.equal(byConvention,557+557+400);
});

test('critic r3: number of drawers and facade heights keep anthracite and facade screws; depth change does not move drawers in height',()=>{
  const m=axis();m.kdrawers=m.kdrawers!.map(k=>({...k,color:'anthracite' as const,faceScrews:true,h:(k.h===168?120:k.h) as 86|120}));
  const two=relayoutKDrawers(m,2);assert.ok(two.every(k=>k.color==='anthracite'&&k.faceScrews));
  // глубина: белые — есть 400/450 на все высоты; антрацит H-86 короче 500 нет — длина остаётся, проверка ругается
  const anth={...m,depth:470};assert.ok(validate({...anth,kdrawers:refitKDrawers(anth,'depth')}).some(x=>/не входит в глубину|нет модели/.test(x)));
  const d={...m,kdrawers:m.kdrawers!.map(({color:_c,...k})=>k),depth:520};const r=refitKDrawers(d,'depth')!;
  assert.deepEqual(r.map(k=>[k.y0,k.y1,k.runnerY]),m.kdrawers!.map(k=>[k.y0,k.y1,k.runnerY]));
  assert.ok(r.every(k=>k.len===450),'H-86/120 white: 450 at depth 520');
});

test('critic r3: adding a bottom front rail lifts the drawers (refit) instead of rejecting the change',()=>{
  const m=kitchenBase(initialModule(),600,'drawers' as never);m.rails=[...(m.rails??[]),{place:'front-bottom',height:100,lay:'flat'}];
  assert.ok(validate(m).some(x=>/уходит в дно/.test(x)),'without refit — error');
  m.kdrawers=refitKDrawers(m);
  assert.deepEqual(validate(m).filter(x=>/Ящик/.test(x)),[]);
  assert.deepEqual(partCollisions(parts(m),m).filter(c=>/Axis|ящик/i.test(c.names.join(' '))),[]);
});