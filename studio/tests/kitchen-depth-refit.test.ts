import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {relayoutKDrawers,refitKDrawers,relayoutProblem,MODERN,type KDrawer,type StartDrawer,type ModernDrawer,type VersaliteDrawer} from '../src/kitchenDrawers';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import type {Module} from '../src/model';

// Смена глубины не раскладывает ящики заново: фасады, оси, рейлинги, задние стенки, внутренние ящики остаются как в Базисе,
// меняется только длина — и только на ту, что есть в проектах Базиса (критик n3-runners, блокирующие 1 и 2).
const ETD='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/';
const ref=(k:string,key:string)=>(JSON.parse(readFileSync(ETD+k+'.json','utf8')).modules as RefModule[]).find(x=>x.key===key)!;
const deep=(m:Module,depth:number):Module=>{const n={...m,depth};n.kdrawers=refitKDrawers(n,'depth');return n;};
const facades=(m:Module)=>parts(m).filter(p=>/^kd:\d+:facade$/.test(p.id)).map(p=>[p.position[1]-p.size[1]/2,p.position[1]+p.size[1]/2].map(v=>Math.round(v*10)/10));
const noLen=(ks:KDrawer[])=>ks.map(k=>{const {len:_l,...r}=k as StartDrawer;return r;});

test('СТАРТ depth refit keeps the Bazis layout: same depth — identical and still PASS; −20 — only the length (500 → 400), facades and railings stay',{skip:!existsSync(ETD+'k27.json')},()=>{
  const r=ref('k27','m01'),{module:m}=moduleFromEtalon(r);
  const same=deep(m,m.depth);assert.deepEqual(same.kdrawers,m.kdrawers);assert.ok(compareModule(r,same).pass);
  const d=deep(m,m.depth-20),ks=d.kdrawers as StartDrawer[];
  assert.deepEqual(noLen(ks),noLen(m.kdrawers!),'y0/y1, runnerY, railYs, railDy, backH, front, inner, edge — unchanged');
  assert.ok(ks.every(k=>k.len===400),'SB20 400 is in Bazis; 500 no longer fits with spare 20');
  assert.deepEqual(facades(d),facades(m));assert.deepEqual(validate(d),[]);
  const back=deep(d,m.depth);assert.deepEqual(back.kdrawers,m.kdrawers,'depth back — Bazis drawers back');
});

test('СТАРТ depth refit keeps the inner drawer without its own facade (k17 m02 at −10): no facade the Bazis project does not have',{skip:!existsSync(ETD+'k17.json')},()=>{
  const {module:m}=moduleFromEtalon(ref('k17','m02'));const ks=m.kdrawers as StartDrawer[];assert.ok(ks.some(k=>k.inner));
  const d=deep(m,m.depth-10);assert.equal(facades(d).length,facades(m).length);assert.deepEqual(facades(d),facades(m));
  assert.deepEqual((d.kdrawers as StartDrawer[]).map(k=>!!k.inner),ks.map(k=>!!k.inner));
});

test('СТАРТ depth refit: SB08/SB19 have only 500 in Bazis — no invented 400, validation says it does not fit',()=>{
  const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,2,undefined,'start-sc').map(k=>({...(k as StartDrawer),sb:'SB08' as const,rail:undefined}));
  const d=deep(m,450);assert.ok((d.kdrawers as StartDrawer[]).every(k=>k.len===500&&k.sb==='SB08'));
  assert.ok(validate(d).some(x=>/не входит в глубину/.test(x)));
});

test('MODERN SLIDE: runner only 500 / box 490 (as in Bazis) — depth changes nothing, validation names the depth it needs, label and estimate say 500',()=>{
  const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;m.depth=515;
  m.kdrawers=relayoutKDrawers(m,3,undefined,'modern-slide');const ks=m.kdrawers as ModernDrawer[];
  assert.ok(ks.every(k=>k.box.len===MODERN.box),'515 deep: box 490 like k09 m05 (was depth−28 = 487)');assert.deepEqual(validate(m).filter(x=>/Ящик/.test(x)),[]);
  for(const D of [480,450,400]){
    const d=deep(m,D);assert.deepEqual(d.kdrawers,m.kdrawers,'no invented runner length');
    assert.ok(validate(d).some(x=>/MODERN SLIDE 500.*нужна глубина от 500/.test(x)),String(D));
    assert.ok(parts(d).filter(p=>p.id.includes(':slide:')).every(p=>/MODERN SLIDE 500 /.test(p.name)));
    assert.throws(()=>estimate({...newProject(),modules:[{...newProject().modules[0],module:d}]}),/нужна глубина от 500/,'invalid module is not priced');
    assert.ok(/нужна глубина корпуса от 500/.test(relayoutProblem(d,3)??''));
    assert.ok((relayoutKDrawers(d,3) as ModernDrawer[]).every(k=>k.box.len===MODERN.box));
  }
  assert.deepEqual(deep(deep(m,450),515).kdrawers,m.kdrawers,'depth back — the same box');
  const m0=kitchenBase(initialModule(),600,'drawers' as never);m0.doors=false;m0.sections[0].shelves=[];m0.sections[0].drawers=0;m0.kdrawers=relayoutKDrawers(m0,3,undefined,'modern-slide');
  const p=newProject();p.modules[0]={...p.modules[0],module:m0};const s=JSON.stringify(estimate(p));assert.ok(s.includes('modern-slide:500')&&!/modern-slide:(?!500)\d/.test(s));
  const odd={...m,kdrawers:ks.map(k=>({...k,box:{...k.box,len:460}}))};assert.ok(validate(odd).some(x=>/только 490/.test(x)));
});

test('MODERN SLIDE k09 m05: Bazis runner points come out of the rule (front − 500), same-depth refit keeps panels and holes',{skip:!existsSync(ETD+'k09.json')},()=>{
  const r=ref('k09','m05'),{module:m}=moduleFromEtalon(r);
  const same=deep(m,m.depth);assert.deepEqual(same.kdrawers,m.kdrawers);const c=compareModule(r,same);
  assert.equal(c.missing.length+c.extra.length,0);assert.equal(c.holes!.missing.length+c.holes!.extra.length,0);
  assert.ok((m.kdrawers as ModernDrawer[]).every(k=>k.box.len===MODERN.box));
  const noRuns={...m,kdrawers:(m.kdrawers as ModernDrawer[]).map(k=>{const {runs:_r,...box}=k.box;return {...k,box};})};
  const a=parts(m).filter(p=>p.id.includes(':slide:')).map(p=>p.anchor),b=parts(noRuns).filter(p=>p.id.includes(':slide:')).map(p=>p.anchor);
  assert.deepEqual(b,a.filter(p=>p![2]<100),'rear runner points of Bazis (the front ones are on the facade)');
});

test('Versalite depth refit keeps the Bazis runner while it fits (k10 m12: 550 at spare 18, k08 m04: 450 at spare 7); D=350 — runner 350.5 does not fit',{skip:!existsSync(ETD+'k10.json')},()=>{
  for(const [k,key,len] of [['k10','m12',550],['k08','m04',450]] as const){
    const r=ref(k,key),{module:m}=moduleFromEtalon(r);assert.ok((m.kdrawers as VersaliteDrawer[]).every(x=>x.len===len));
    const same=deep(m,m.depth);assert.deepEqual(same.kdrawers,m.kdrawers,k+key);
    const less=deep(m,m.depth-30);assert.ok((less.kdrawers as VersaliteDrawer[]).every(x=>x.len<len&&x.box.len===x.len),k+key);
  }
  const {module:m}=moduleFromEtalon(ref('k10','m12'));const d=deep(m,350);
  assert.ok((d.kdrawers as VersaliteDrawer[]).every(x=>x.len===350));assert.ok(validate(d).some(x=>/Versalite 350 \(350\.5 по модели Базиса\) не входит/.test(x)));
});

test('kitchen estimate has no rows the Bazis projects lack: no confirmat caps, no «мелочёвка корпуса»; wardrobes keep them',()=>{
  const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;m.kdrawers=relayoutKDrawers(m,3);
  const p=newProject();p.modules[0]={...p.modules[0],module:m};const e=estimate(p);
  assert.ok(e.lines.some(l=>l.id==='confirmat-7x50'));assert.equal(e.lines.find(l=>l.id==='confirmat-cap'),undefined);assert.equal(e.lines.find(l=>l.id==='kit'),undefined);
  const w=estimate(newProject());assert.ok(w.lines.some(l=>l.id==='confirmat-cap')&&w.lines.some(l=>l.id==='kit'));
});

test('СТАРТ estimate: second railing on each side (k27 m01 railYs 206.5/260.5) — a separate row for the extra pairs',{skip:!existsSync(ETD+'k27.json')},()=>{
  const {module:m}=moduleFromEtalon(ref('k27','m01'));const p=newProject();p.modules[0]={...p.modules[0],module:m};
  const e=estimate(p) as unknown as {lines?:{id:string;quantity:number}[]};const s=JSON.stringify(e);
  assert.ok(s.includes('start-sc:rail:500'));
  const row=JSON.parse(s,(_k,v)=>v);const all:{id:string;quantity:number}[]=[];JSON.stringify(row,(_k,v)=>{if(v&&typeof v==='object'&&v.id==='start-sc:rail:500')all.push(v);return v;});
  assert.equal(all[0].quantity,2,'2 drawers × 1 extra pair');
});
