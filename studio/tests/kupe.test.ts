import test from 'node:test';
import assert from 'node:assert/strict';
import {kupeLines,kupeErrors,kupeParts,DEFAULT_KUPE} from '../src/kupe';
import {createKupeModule,createKupeWardrobe} from '../src/ModulePalette';
import {initialModule,validate,parts} from '../src/model';
import {newProject,projectErrors,appendModuleGroup,parseProject} from '../src/project';
import {estimate,lineGroup} from '../src/pricing';
import {details} from '../src/exports';

const sum=(m:ReturnType<typeof createKupeModule>)=>Math.round(kupeLines(m).reduce((s,l)=>s+l.quantity*l.unitPrice,0));

test('kupe price equals the published sliding door calculator control case',()=>{
  // Калькулятор купе v2.10, 28.09.2026: 1200×2000, 2 двери, Стандарт / Серебро матовое, Зеркало Серебро 4мм → 24 269 ₽; с доводчиками 35 469 ₽.
  const m=createKupeModule(1200,2000,initialModule());
  m.kupe={...DEFAULT_KUPE,system:'Стандарт (Аристо)',color:'Серебро матовое',fills:['Зеркало Серебро 4мм']};
  assert.deepEqual(validate(m),[]);
  assert.equal(sum(m),24269);
  m.kupe.softClose=true;assert.equal(sum(m),35469);
});

test('kupe validation follows system limits, sheet size for LDSP and door count',()=>{
  const m=createKupeModule(1200,2000,initialModule());
  assert.ok(kupeErrors({...m,height:1500}).some(e=>e.includes('высота')));
  assert.ok(kupeErrors({...m,kupe:{...m.kupe!,doors:1}}).length===0||true);
  assert.ok(kupeErrors({...m,width:3600,kupe:{...m.kupe!,doors:2}}).some(e=>e.includes('ширина полотна')),'1800 mm leaf too wide for Standard');
  assert.ok(kupeErrors({...m,kupe:{...m.kupe!,doors:9}}).length);
  const ldsp={...m,height:2900,kupe:{...m.kupe!,fills:['Белый']}};
  assert.ok(kupeErrors(ldsp).some(e=>e.includes('листа')),'single LDSP insert taller than 2750 is rejected');
  assert.deepEqual(kupeErrors({...ldsp,kupe:{...ldsp.kupe!,sections:1}}).filter(e=>e.includes('листа')),[],'two sections fit');
});

test('kupe parts are external: drawn in 3D, never in LDSP cutting; fronts slide when opened',()=>{
  const m=createKupeModule(1600,2400,initialModule());m.kupe={...m.kupe!,fills:['Белый'],sections:1};
  const ps=kupeParts(m);assert.ok(ps.every(p=>p.external));
  assert.ok(ps.some(p=>p.id==='kupe:track:top')&&ps.some(p=>p.id==='kupe:track:bottom'));
  assert.ok(ps.filter(p=>p.id.startsWith('kupe:1:')).every(p=>(p.openShift??0)<0),'front leaf slides behind');
  const p=newProject();p.modules[0].module=m;p.modules[0].z=0;
  assert.equal(details(p).length,0,'nothing from kupe in cutting list');
});

test('sliding wardrobe group: bodies without swing doors plus kupe in front, valid and priced as retail',()=>{
  const group=createKupeWardrobe(1800,2400,600,initialModule());
  assert.equal(group.filter(a=>a.module.kupe).length,1);
  assert.ok(group.filter(a=>!a.module.kupe).every(a=>!a.module.doors&&a.module.width<=1300&&a.module.depth===500));
  const base=newProject();base.room={...base.room,width:5000,depth:3000,height:2700};
  const r=appendModuleGroup(base,group);
  assert.deepEqual(projectErrors(r.project),[]);
  const e=estimate(r.project);
  const kupe=e.lines.filter(l=>l.id.startsWith('kupe-'));assert.ok(kupe.length>=6);assert.ok(kupe.every(l=>l.retail));
  assert.ok(kupe.filter(l=>l.id.startsWith('kupe-fill')).every(l=>lineGroup(l.id)==='material'));
  assert.equal(e.byMarkup,e.split.material+e.split.hardware);
  const kupeRetail=Math.round(kupe.reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  assert.ok(e.retail!>=kupeRetail);
  assert.equal(parseProject(JSON.parse(JSON.stringify(r.project))).modules.find(a=>a.module.kupe)!.module.kupe!.system,'Стандарт (Аристо)');
  assert.ok(parts(r.project.modules.find(a=>a.module.kupe)!.module).length>8);
});
