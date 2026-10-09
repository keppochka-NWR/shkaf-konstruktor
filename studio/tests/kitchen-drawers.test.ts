import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {axisLayout,axisFits,axisTop,axisCeiling,relayoutKDrawers,refitKDrawers,firmaxSetScrews} from '../src/kitchenDrawers';
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
// Firmax скрытого монтажа: короб ЛДСП как в Базисе k14/m10 (НМВЯ 2, 800×820, три ящика)
const firmax=()=>{const m=kitchenBase(initialModule(),800,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=[{system:'firmax-ldsp',y0:101.5,y1:471.5,runnerY:116,box:{y:152,h:264.5,len:490,screws:true}},{system:'firmax-ldsp',y0:474.5,y1:671,runnerY:474.5,box:{y:514.5,h:121.5,len:490,screws:true}},{system:'firmax-ldsp',y0:674,y1:819,runnerY:674,box:{y:704.5,h:92.5,len:490,bottomUp:5,screws:true}}];return m;};

test('Firmax box: LDSP 16 sides 5 mm from the cabinet, bottom 10 (5) above their lower edge, back and false panel between sides on the bottom',()=>{
  const m=firmax(),ps=parts(m),L=ps.find(p=>p.id==='left')!,x0=L.position[0]+L.size[0]/2,F=L.position[2]+L.size[2]/2;
  const g=(id:string)=>{const p=ps.find(q=>q.id===id)!;return {lo:p.position.map((v,i)=>Math.round((v-p.size[i]/2)*10)/10),hi:p.position.map((v,i)=>Math.round((v+p.size[i]/2)*10)/10),p};};
  const s=g('kd:0:fx:side:L');assert.deepEqual([s.lo[0]-x0,s.hi[0]-x0,s.lo[1],s.hi[1],F-s.lo[2],F-s.hi[2]],[5,21,152,416.5,490,0]);
  const b=g('kd:0:fx:bottom');assert.deepEqual([b.lo[0]-x0,b.lo[1],b.hi[1],b.p.size[2]],[21,162,178,490]);assert.equal(b.p.size[0],800-32-2*21);
  const k=g('kd:0:fx:back'),f=g('kd:0:fx:front');assert.deepEqual([k.lo[1],k.hi[1],F-k.lo[2]],[178,416.5,490]);assert.deepEqual([f.lo[1],f.hi[2]],[178,Math.round(F*10)/10]);
  assert.equal(g('kd:2:fx:bottom').lo[1],709.5,'bottomUp 5');
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('Firmax edges by Bazis: box sides +-y and -z, back and false panel +y, bottom -z',()=>{
  const m=firmax();m.edgeScheme={t:0.5} as never;const ps=parts(m),e=(id:string)=>Object.keys(edgeByDir(ps.find(p=>p.id===id)!)).sort();
  assert.deepEqual(e('kd:1:fx:side:L'),['+y','-y','-z']);assert.deepEqual(e('kd:1:fx:back'),['+y']);assert.deepEqual(e('kd:1:fx:front'),['+y']);assert.deepEqual(e('kd:1:fx:bottom'),['-z']);
});

test('Firmax hardware and drilling: runners at the Bazis point, confirmats D8x16 + D5x37, 3x3 in cabinet sides, 5x12 in the bottom rear edge',()=>{
  const m=firmax(),ps=parts(m),h=holes(m),L=ps.find(p=>p.id==='left')!,x0=L.position[0]+L.size[0]/2,F=L.position[2]+L.size[2]/2;
  const runs=ps.filter(p=>p.id.startsWith('kd:2:slide:'));assert.equal(runs.length,2);assert.deepEqual(runs[0].anchor,[x0,674,F]);
  assert.ok(runs.every(r=>r.material==='metal'&&!r.model&&r.position[1]+r.size[1]/2<=709.5),'rail under the bottom, no Bazis mesh');
  const conf=ps.filter(p=>p.id.startsWith('fast:kd:0:'));assert.equal(conf.length,2*(2*2+2),'2 per back/false panel + 2 into the bottom, per side');
  assert.equal(h.filter(x=>x.part==='kd:0:fx:side:L'&&x.d===8&&x.depth===16).length,6);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:back'&&x.d===5&&x.depth===37).length,4);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:bottom'&&x.d===5&&x.depth===37).length,4);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:bottom'&&x.d===5&&x.depth===12).length,2);
  assert.equal(h.filter(x=>x.part==='left'&&x.d===3&&x.depth===3).length,6,'3x3: 2 per drawer');
  assert.equal(ps.filter(p=>p.id.startsWith('kd:')&&p.id.includes(':screw:fx3:')).length,12);
});

test('Firmax: system switch keeps the facades, layout fits, save/load round trip, depth refit and validation',()=>{
  const m=firmax(),back=parseModule(JSON.parse(JSON.stringify(m)))!;assert.deepEqual(back.kdrawers,m.kdrawers);
  const r=relayoutKDrawers(m,3,m.kdrawers!.map(k=>k.y1-k.y0),'firmax-ldsp');assert.ok(r.every(k=>k.system==='firmax-ldsp'&&axisFits(m,k)));
  const ax=relayoutKDrawers(m,3,undefined,'axis-pro');assert.ok(ax.every(k=>k.system==='axis-pro'));
  const n={...m,kdrawers:r};assert.deepEqual(validate(n),[]);assert.deepEqual(partCollisions(parts(n),n),[]);
  const deep={...m,depth:450};assert.equal(refitKDrawers(deep,'depth')!.every(k=>k.system==='firmax-ldsp'&&k.box.len<=410),true);
  const bad={...m,kdrawers:[{system:'firmax-ldsp' as const,y0:101.5,y1:471.5,runnerY:116,box:{y:152,h:40,len:490}}]};assert.ok(validate(bad).some(x=>/боковины от 60/.test(x)));
});

// Критик Firmax р.1: ящик из панели или после смены высоты не должен уходить в цех без 3×3 направляющих и шурупов фасада
const cnt=(m:ReturnType<typeof firmax>)=>{const h=holes(m);return {d3:h.filter(x=>x.d===3&&x.depth===3).length,d516:h.filter(x=>x.d===5&&x.depth===16).length};};
test('Firmax height refit keeps runner screws D3x3, face screws D5x16, 5x12 choice, gap and front offset',()=>{
  const m=firmax();m.kdrawers=m.kdrawers!.map((k,i)=>k.system==='firmax-ldsp'?{...k,box:{...k.box,faceScrews:i===1?[[60,50],[300,20]] as [number,number][]:true,gap:5,front:0,confBottom:53}}:k);
  const c0=cnt(m);assert.ok(c0.d3>=12&&c0.d516>=8,'source has screws');
  for(const dh of [-100,100]){
    const n={...m,height:m.height+dh};n.kdrawers=refitKDrawers(n,'height');
    const c=cnt(n);assert.ok(c.d3>=c0.d3,`height ${dh}: D3x3 ${c.d3} < ${c0.d3}`);assert.ok(c.d516>=c0.d516,`height ${dh}: D5x16 ${c.d516} < ${c0.d516}`);
    assert.ok(n.kdrawers!.every(k=>k.system==='firmax-ldsp'&&k.box.screws&&k.box.faceScrews&&k.box.gap===5&&k.box.front===0&&k.box.confBottom===53));
    assert.deepEqual(validate(n),[]);assert.deepEqual(partCollisions(parts(n),n),[]);
  }
  const no5={...m,kdrawers:m.kdrawers!.map(k=>k.system==='firmax-ldsp'?{...k,box:{...k.box,rearHoles:false,screws:false}}:k)};
  const r=refitKDrawers({...no5,height:m.height-100},'height')!;assert.ok(r.every(k=>k.system==='firmax-ldsp'&&k.box.rearHoles===false&&!k.box.screws),'Bazis project without 3x3 / 5x12 stays so');
});
test('Firmax from the panel (system switch, count) has runner screws D3x3 by default, like 17 of 19 Bazis modules',()=>{
  const ax=axis(),f=relayoutKDrawers(ax,3,ax.kdrawers!.map(k=>k.y1-k.y0),'firmax-ldsp');assert.ok(f.every(k=>k.system==='firmax-ldsp'&&k.box.screws));
  const n={...ax,kdrawers:f};assert.equal(cnt(n as never).d3,12,'2 per side per drawer');assert.deepEqual(validate(n),[]);assert.deepEqual(partCollisions(parts(n),n),[]);
  const two=relayoutKDrawers(n,2);assert.ok(two.every(k=>k.system==='firmax-ldsp'&&k.box.screws));
});
test('Firmax panel toggles bring back D3x3 runner screws and face screws D5x16; own Bazis points are kept',()=>{
  const m=firmax();m.kdrawers=firmaxSetScrews(m.kdrawers!,'screws',false);assert.equal(cnt(m).d3,0);
  m.kdrawers=firmaxSetScrews(m.kdrawers!,'screws',true);assert.equal(cnt(m).d3,12);
  m.kdrawers=m.kdrawers!.map((k,i)=>i===1&&k.system==='firmax-ldsp'?{...k,box:{...k.box,faceScrews:[[60,50]] as [number,number][]}}:k);
  m.kdrawers=firmaxSetScrews(m.kdrawers!,'faceScrews',true);const b=m.kdrawers!.map(k=>k.system==='firmax-ldsp'?k.box.faceScrews:undefined);
  assert.deepEqual(b,[true,[[60,50]],true]);assert.equal(cnt(m).d516,3+1+3);assert.deepEqual(partCollisions(parts(m),m),[]);
  m.kdrawers=firmaxSetScrews(m.kdrawers!,'faceScrews',false);assert.equal(cnt(m).d516,0);
});