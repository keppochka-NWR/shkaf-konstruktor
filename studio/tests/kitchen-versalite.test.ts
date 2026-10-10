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
import {relayoutKDrawers,refitKDrawers,axisFits,versaliteLen,VERSALITE,type VersaliteDrawer} from '../src/kitchenDrawers';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';

// Versalite Light H45 — короб ЛДСП на шариковых направляющих, как в Базисе k10/m12 (НМ 520, три ящика, направляющие 550)
const vl=(w=520)=>{const m=kitchenBase(initialModule(),w,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,3,undefined,'versalite-h45');return m;};
const VLK=(m:ReturnType<typeof vl>)=>m.kdrawers!.filter((k):k is VersaliteDrawer=>k.system==='versalite-h45');

test('Versalite layout: box from facade bottom +24 to facade top -21, runner axis in the middle of the box side, longest runner with 20 spare',()=>{
  const m=vl(),ks=VLK(m);assert.equal(ks.length,3);
  assert.equal(versaliteLen({...m,depth:560}),500);assert.equal(versaliteLen({...m,depth:571}),550);assert.equal(versaliteLen({...m,depth:376}),350);
  for(const k of ks){
    assert.equal(k.len,versaliteLen(m));assert.equal(k.box.len,k.len);
    assert.ok(Math.abs(k.box.y-Math.max(k.y0+24,0))<0.11||k.box.y>=k.y0+24-0.1,'box from facade bottom +24');
    assert.ok(k.box.y+k.box.h<=k.y1-21+0.1,'box top 21 below the facade top');
    assert.equal(k.runnerY,Math.round((k.box.y+k.box.h/2)*10)/10);assert.ok(axisFits(m,k));
  }
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(partCollisions(parts(m),m),[],'no collisions: runner 12.7 in the 13 gap, screws and confirmats in their panels');
});

test('Versalite box like Bazis: sides 13 from the cabinet, bottom at their lower edge, back and false panel on the bottom; edges as Firmax',()=>{
  const m=vl();m.edgeScheme={t:0.5} as never;const ps=parts(m),L=ps.find(p=>p.id==='left')!,R=ps.find(p=>p.id==='right')!,x0=L.position[0]+L.size[0]/2,xr=R.position[0]-R.size[0]/2,F=L.position[2]+L.size[2]/2;
  const k=VLK(m)[0],g=(id:string)=>ps.find(p=>p.id===id)!;
  const sl=g('kd:0:fx:side:L'),sr=g('kd:0:fx:side:R'),bot=g('kd:0:fx:bottom'),back=g('kd:0:fx:back'),fr=g('kd:0:fx:front');
  assert.equal(sl.position[0]-8,x0+13);assert.equal(sr.position[0]+8,xr-13);
  assert.equal(sl.size[1],k.box.h);assert.equal(sl.size[2],k.box.len);assert.equal(sl.position[2]+k.box.len/2,F);
  assert.equal(bot.position[1]-8,k.box.y,'bottom at the lower edge of the sides');assert.equal(bot.size[0],xr-x0-26-32);
  assert.equal(back.size[1],k.box.h-16);assert.equal(back.position[2]-8,F-k.box.len);assert.equal(fr.position[2]+8,F);
  assert.ok(sl.name.includes('Versalite')&&!sl.name.includes('Firmax'));
  const e=(id:string)=>Object.keys(edgeByDir(ps.find(p=>p.id===id)!)).sort();
  assert.deepEqual(e('kd:0:fx:side:L'),['+y','-y','-z']);assert.deepEqual(e('kd:0:fx:bottom'),['-z']);assert.deepEqual(e('kd:0:fx:back'),['+y']);
});

test('Versalite hardware and drilling by Bazis FurnList: mesh runners at the Bazis point, 3.5x16 screws 2+3, D6x1 / D3x1.2 / D5x1.2, confirmats 2+2+2 per side + 4 from below',()=>{
  const m=vl(),ps=parts(m),h=holes(m),L=ps.find(p=>p.id==='left')!,x0=L.position[0]+L.size[0]/2,F=L.position[2]+L.size[2]/2,k=VLK(m)[0];
  const run=ps.find(p=>p.id==='kd:0:slide:L')!;
  assert.deepEqual(run.model!.origin,[x0,k.runnerY,F]);assert.ok(run.model!.file.includes(k.len===550?'188b3778a7e0':k.len===500?'ed63f368aba0':''));
  assert.ok(existsSync(new URL('../public/models/hardware/bazis/'+run.model!.file.split('/').pop(),import.meta.url)),'Bazis mesh exists');
  assert.ok(run.size[0]<=12.8,'runner 12.7 thick, fits the 13 gap');
  const screws=ps.filter(p=>p.id.startsWith('kd:0:screw:'));assert.equal(screws.length,2*(2+3));
  const corp6=h.filter(x=>x.part==='left'&&x.d===6&&x.depth===1&&Math.abs(x.at[1]-k.runnerY)<0.01);assert.equal(corp6.length,k.len>=450?(k.len===450?5:6):4);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:side:L'&&x.d===3&&x.depth===1.2).length,4);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:side:L'&&x.d===5&&x.depth===1.2).length,k.len===350?0:1);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:side:L'&&x.d===3&&x.depth===3).length,3);
  assert.equal(h.filter(x=>x.part==='left'&&x.d===3&&x.depth===3&&Math.abs(x.at[1]-k.runnerY)<0.01).length,2);
  const conf=ps.filter(p=>p.id.startsWith('fast:kd:0:'));const backH=k.box.h-16,nb=backH<90?1:2;
  assert.equal(conf.length,2*(2*nb+2)+4);
  assert.equal(h.filter(x=>x.part==='kd:0:fx:bottom'&&x.d===8&&x.depth===16).length,4,'under confirmats D8x16 through the bottom');
  assert.equal(h.filter(x=>x.part==='kd:0:fx:back'&&x.d===5&&x.depth===37).length,2*nb+2);
});

test('Versalite: save/load round trip, system switch, height/depth refit, validation and estimate row without price',()=>{
  const m=vl();m.kdrawers=VLK(m).map((k,i)=>i===0?{...k,box:{...k.box,confUnder:63,confBottom:65,gap:12}}:k);
  const back=parseModule(JSON.parse(JSON.stringify(m)))!;assert.deepEqual(back.kdrawers,m.kdrawers);
  const ax=relayoutKDrawers(m,3,undefined,'axis-pro');assert.ok(ax.every(k=>k.system==='axis-pro'));
  const fx=relayoutKDrawers(m,2,undefined,'firmax-ldsp');assert.ok(fx.every(k=>k.system==='firmax-ldsp'));
  const n={...m,height:m.height-100};n.kdrawers=refitKDrawers(n,'height');
  assert.ok(n.kdrawers!.every(k=>k.system==='versalite-h45'));const k0=n.kdrawers![0] as VersaliteDrawer;
  assert.equal(k0.box.confUnder,63);assert.equal(k0.box.confBottom,65);assert.equal(k0.box.gap,12);
  assert.deepEqual(validate(n),[]);assert.deepEqual(partCollisions(parts(n),n),[]);
  const d={...m,depth:400};d.kdrawers=refitKDrawers(d,'depth');assert.ok(d.kdrawers!.every(k=>k.system==='versalite-h45'&&k.len===350&&k.box.len===350));
  const bad={...m,kdrawers:[{...VLK(m)[0],runnerY:VLK(m)[0].box.y+5}]};assert.ok(validate(bad).some(x=>/выходит за боковину/.test(x)));
  const p=newProject();p.modules[0].module=vl();const s=JSON.stringify(estimate(p));
  assert.ok(s.includes('versalite-h45:'+VLK(vl())[0].len),'estimate row for Versalite runners');assert.ok(!s.includes('axis-pro:undefined'));
  assert.equal(VERSALITE.gap,13);
});

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на другой машине тест пропускается.
const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k10.json';
test('Versalite recognizer + compare on Bazis k10/m12: 3 drawers, all panels within 0.5, runners/screws/confirmats as in Bazis',{skip:!existsSync(ET)},()=>{
  const ref=(JSON.parse(readFileSync(ET,'utf8')).modules as RefModule[]).find(x=>x.key==='m12')!;
  const {module:m}=moduleFromEtalon(ref);const ks=m.kdrawers!;assert.equal(ks.length,3);assert.ok(ks.every(k=>k.system==='versalite-h45'&&k.len===550));
  const c=compareModule(ref,m);
  assert.equal(c.missing.length,0);assert.equal(c.extra.length,0);assert.ok(c.pairs.every(p=>p.delta<=0.5));
  const row=(cat:string)=>c.hardware.find(r=>r.category===cat)!;
  assert.equal(row('направляющая').studio,6);assert.equal(row('направляющая').maxPosDelta,0);
  assert.equal(row('конфирмат').studio,row('конфирмат').ref);
  // «прочее» в Базисе — 30 шурупов ящиков + 2 «5» на боковинах: стяжки соседних модулей в углу среднего выреза Gola (n6, kitchen.golaTies)
  assert.equal(row('прочее').studio,32);assert.equal(row('прочее').ref,32);
  assert.deepEqual(c.holes!.missing,[],'D5x16 стяжек Gola — как в Базисе');
});
