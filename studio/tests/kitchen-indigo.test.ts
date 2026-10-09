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
import {relayoutKDrawers,refitKDrawers,indigoFits,type IndigoDrawer} from '../src/kitchenDrawers';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';

// Indigo — металлические царги H=175 / H=90, как в Базисе k16/m04 (НМ 600, три ящика: 175, 175, 90)
const ig=(n=3)=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,n,undefined,'indigo');return m;};
const IK=(m:ReturnType<typeof ig>)=>m.kdrawers!.filter((k):k is IndigoDrawer=>k.system==='indigo');

test('Indigo layout and parts like Bazis: runner 44 above the facade bottom, H=175 where it fits else H=90; bottom 19 narrower at runner-5, back 42 narrower at runner+11.4',()=>{
  const m=ig(),ks=IK(m);assert.equal(ks.length,3);assert.ok(ks.every(k=>indigoFits(m,k)));assert.ok(ks.some(k=>k.hc===175));
  const ps=parts(m),L=ps.find(p=>p.id==='left')!,R=ps.find(p=>p.id==='right')!,x0=L.position[0]+L.size[0]/2,xr=R.position[0]-R.size[0]/2,F=L.position[2]+L.size[2]/2,k=ks[0];
  const b=ps.find(p=>p.id==='kd:0:bottom')!,bk=ps.find(p=>p.id==='kd:0:back')!;
  assert.equal(b.size[0],xr-x0-19);assert.equal(b.position[1]-8,k.runnerY-5);assert.equal(Math.round((b.position[2]+b.size[2]/2)*10)/10,F-0.4);
  assert.equal(bk.size[0],xr-x0-42);assert.equal(Math.round((bk.position[1]-bk.size[1]/2)*10)/10,Math.round((k.runnerY+11.4)*10)/10);
  assert.deepEqual(ps.find(p=>p.id==='kd:0:sys:side:L')!.model!.origin,[x0,k.runnerY-44,F]);
  for(const p of ps.filter(q=>q.model&&q.id.startsWith('kd:')))assert.ok(existsSync(new URL('../public/models/hardware/bazis/'+p.model!.file.split('/').pop(),import.meta.url)),p.name);
  m.edgeScheme={t:0.5} as never;const e=(id:string)=>Object.keys(edgeByDir(parts(m).find(p=>p.id===id)!)).sort();
  assert.deepEqual(e('kd:0:bottom'),['+z','-z']);assert.deepEqual(e('kd:0:back'),['+y','-y']);
  assert.deepEqual(validate(m),[]);assert.deepEqual(partCollisions(parts(m),m),[]);
});

test('Indigo drilling: 12 x D6.5x2 per runner, 3x3 in cabinet side / back / facade; save-load, switch, refit, estimate without price',()=>{
  const m=ig(),h=holes(m),k=IK(m)[0];
  assert.equal(h.filter(x=>x.part==='left'&&x.d===6.5&&x.depth===2&&Math.abs(x.at[1]-k.runnerY)<0.01).length,12);
  assert.equal(h.filter(x=>x.part==='left'&&x.d===3&&x.depth===3&&Math.abs(x.at[1]-k.runnerY)<0.01).length,4);
  assert.equal(h.filter(x=>x.part==='kd:0:back'&&x.d===3).length,2*(k.hc===175?3:2));
  assert.equal(h.filter(x=>x.part==='kd:0:facade'&&x.d===3).length,2*(k.hc===175?4:2));
  const back=parseModule(JSON.parse(JSON.stringify(m)))!;assert.deepEqual(back.kdrawers,m.kdrawers);
  assert.ok(relayoutKDrawers(m,3,undefined,'axis-pro').every(x=>x.system==='axis-pro'));
  const n={...m,height:m.height-80};n.kdrawers=refitKDrawers(n,'height');assert.ok(n.kdrawers!.every(x=>x.system==='indigo'));assert.deepEqual(validate(n),[]);
  const p=newProject();p.modules[0].module=ig();const s=JSON.stringify(estimate(p));assert.ok(s.includes('indigo:175:500'));
});

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k16.json';
test('Indigo recognizer + compare: Bazis k16/m04 and m05 match fully (panels, hardware, holes, edges)',{skip:!existsSync(ET)},()=>{
  for(const key of ['m04','m05']){
    const ref=(JSON.parse(readFileSync(ET,'utf8')).modules as RefModule[]).find(x=>x.key===key)!;
    const {module:m}=moduleFromEtalon(ref);assert.ok(m.kdrawers!.length===3&&m.kdrawers!.every(k=>k.system==='indigo'),key);
    const c=compareModule(ref,m);assert.ok(c.pass,key+' '+JSON.stringify({hw:c.hardware,holes:c.holes?.missing.slice(0,4)}));
  }
});
