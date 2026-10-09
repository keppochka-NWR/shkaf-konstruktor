import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {edgeByDir} from '../src/edges';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {relayoutKDrawers,refitKDrawers,startFits,startTop,START,type StartDrawer} from '../src/kitchenDrawers';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';

// Boyard СТАРТ — металлические боковины SB08/SB19/SB20, как в Базисе k27/m01 (НМ 600, два ящика SB20 с рейлингом)
const st=(w=600,n=2)=>{const m=kitchenBase(initialModule(),w,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,n,undefined,'start-sc');return m;};
const SK=(m:ReturnType<typeof st>)=>m.kdrawers!.filter((k):k is StartDrawer=>k.system==='start-sc');

test('СТАРТ layout: runner 64 above the facade bottom, the tallest side that fits (SB20 with railing on two drawers, lower on four), 500 with 20 spare',()=>{
  const m=st(),ks=SK(m);assert.equal(ks.length,2);
  for(const k of ks){assert.equal(k.sb,'SB20');assert.ok(k.rail);assert.equal(k.len,m.depth-20>=500?500:400);assert.ok(startFits(m,k));assert.ok(k.runnerY>=k.y0+64-0.01);}
  const four=st(600,4);assert.ok(SK(four).every(k=>startFits(four,k)&&startTop(k)<=k.y1-20+0.01));assert.ok(SK(four).some(k=>k.sb!=='SB20'),'low facades get SB19/SB08');
  assert.deepEqual(validate(m),[]);assert.deepEqual(partCollisions(parts(m),m),[]);assert.deepEqual(partCollisions(parts(four),four),[]);
});

test('СТАРТ parts like Bazis: LDSP bottom 75 narrower and len-24 deep at the side bottom (runner -7), back 87 narrower, 220 high for SB20; Bazis meshes',()=>{
  const m=st(),ps=parts(m),L=ps.find(p=>p.id==='left')!,R=ps.find(p=>p.id==='right')!,x0=L.position[0]+L.size[0]/2,xr=R.position[0]-R.size[0]/2,F=L.position[2]+L.size[2]/2,k=SK(m)[0];
  const b=ps.find(p=>p.id==='kd:0:bottom')!,bk=ps.find(p=>p.id==='kd:0:back')!;
  assert.equal(b.size[0],xr-x0-75);assert.equal(b.size[2],k.len-24);assert.equal(b.position[1]-8,k.runnerY-7);assert.equal(b.position[2]+b.size[2]/2,F);
  assert.equal(bk.size[0],xr-x0-87);assert.equal(bk.size[1],START.SB20.back);assert.equal(bk.position[2]-8,F-k.len+8);
  const sys=ps.filter(p=>p.id.startsWith('kd:0:')&&(p.id.includes(':sys:')||p.id.includes(':slide:')||p.id.includes(':cap:')));
  assert.equal(sys.length,2*(1+1+1+1+1+1+1),'runner, side, back holder, front fixing, railing, railing holder, cap per side');
  for(const p of sys)assert.ok(existsSync(new URL('../public/models/hardware/bazis/'+p.model!.file.split('/').pop(),import.meta.url)),p.name);
  assert.deepEqual(ps.find(p=>p.id==='kd:0:slide:L')!.model!.origin,[x0,k.runnerY,F]);
  assert.deepEqual(ps.find(p=>p.id==='kd:0:sys:side:L')!.model!.origin,[x0+37.5,k.runnerY-7,F]);
  m.edgeScheme={t:0.5} as never;const ps2=parts(m),e=(id:string)=>Object.keys(edgeByDir(ps2.find(p=>p.id===id)!)).sort();
  assert.deepEqual(e('kd:0:bottom'),[]);assert.deepEqual(e('kd:0:back'),['+x','+y','-x','-y']);
});

test('СТАРТ drilling by Bazis FurnList: D6x1.5 runner + D3x3 screws in the cabinet side, D4.2x0.75 + D3.5x0.75 in the back, D4x6 + D3x3 in the facade',()=>{
  const m=st(),h=holes(m),k=SK(m)[0];
  assert.equal(h.filter(x=>x.part==='left'&&x.d===6&&x.depth===1.5&&Math.abs(x.at[1]-k.runnerY-16)<0.01).length,4);
  assert.equal(h.filter(x=>x.part==='left'&&x.d===3&&x.depth===3&&Math.abs(x.at[1]-k.runnerY-16)<0.01).length,2);
  assert.equal(h.filter(x=>x.part==='kd:0:back'&&x.d===4.2&&x.depth===0.75).length,2*4);
  assert.equal(h.filter(x=>x.part==='kd:0:back'&&x.d===3.5&&x.depth===0.75).length,2);
  assert.equal(h.filter(x=>x.part==='kd:0:back'&&x.d===4&&x.depth===3).length,2,'railing holders');
  assert.equal(h.filter(x=>x.part==='kd:0:facade'&&x.d===4&&x.depth===6).length,2*(4+1),'front fixing 4 + railing 1 per side');
  assert.equal(h.filter(x=>x.part==='kd:0:facade'&&x.d===3&&x.depth===3).length,2*(4+1));
});

test('СТАРТ: save/load, system switch, refit, validation and estimate kit row without price',()=>{
  const m=st();m.kdrawers=SK(m).map((k,i)=>i===1?{...k,railYs:[206.5,260.5],backH:274,edge:{bottom:true}}:k);
  const back=parseModule(JSON.parse(JSON.stringify(m)))!;assert.deepEqual(back.kdrawers,m.kdrawers);
  assert.ok(relayoutKDrawers(m,2,undefined,'axis-pro').every(k=>k.system==='axis-pro'));
  assert.ok(relayoutKDrawers(m,2,undefined,'versalite-h45').every(k=>k.system==='versalite-h45'));
  const n={...m,height:m.height-60};n.kdrawers=refitKDrawers(n,'height');assert.ok(n.kdrawers!.every(k=>k.system==='start-sc'));
  assert.deepEqual(validate(n),[]);assert.deepEqual(partCollisions(parts(n),n),[]);
  const d={...m,depth:450};d.kdrawers=refitKDrawers(d,'depth');assert.ok(d.kdrawers!.every(k=>k.system==='start-sc'&&k.len===400));
  const bad={...m,kdrawers:[{...SK(m)[0],sb:'SB08' as const,len:400 as const}]};assert.ok(validate(bad).some(x=>/нет модели/.test(x)));
  const p=newProject();p.modules[0].module=st();const s=JSON.stringify(estimate(p));assert.ok(s.includes('start-sc:SB20:'));assert.ok(!s.includes('axis-pro:undefined'));
});

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на другой машине тест пропускается.
const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k27.json';
test('СТАРТ recognizer + compare: Bazis k27/m01 (two SB20 with two railings, back 274) matches fully — panels, hardware, holes, edges',{skip:!existsSync(ET)},()=>{
  const ref=(JSON.parse(readFileSync(ET,'utf8')).modules as RefModule[]).find(x=>x.key==='m01')!;
  const {module:m}=moduleFromEtalon(ref);const ks=m.kdrawers!;assert.equal(ks.length,2);
  assert.ok(ks.every(k=>k.system==='start-sc'&&k.sb==='SB20'&&k.backH===274&&JSON.stringify(k.railYs)==='[206.5,260.5]'));
  const c=compareModule(ref,m);assert.ok(c.pass,JSON.stringify({missing:c.missing.length,extra:c.extra.length,hw:c.hardware,holes:c.holes?.missing.slice(0,4)}));
});
