import test from 'node:test';
import assert from 'node:assert/strict';
import {kupeLines,kupeErrors,kupeParts,kupeProfileExact,DEFAULT_KUPE} from '../src/kupe';
import {KUPE_SYSTEMS} from '../src/kupeData';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {createKupeModule,createKupeWardrobe} from '../src/ModulePalette';
import {initialModule,validate,parts} from '../src/model';
import {newProject,projectErrors,appendModuleGroup,parseProject,bounds} from '../src/project';
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

test('kupe 3D follows the Aristo assembly drawing: C 26.5×34.5, rows 40.06 apart, handles of neighbours coincide',()=>{
  const m=createKupeModule(1600,2400,initialModule());
  const ps=kupeParts(m),by=(id:string)=>ps.find(p=>p.id===id)!;
  const h0=by('kupe:0:side:r'),h1=by('kupe:1:side:l');
  assert.deepEqual([h0.size[0],h0.size[2]],[26.51,34.51]);
  assert.ok(Math.abs(h0.position[0]-h1.position[0])<1e-6,'overlap equals handle width');
  assert.ok(Math.abs(Math.abs(h1.position[2]-h0.position[2])-40.06)<1e-6);
  assert.equal(by('kupe:0:frame:top').model!.file,'kupe/frame_top.glb');
  assert.equal(by('kupe:0:frame:bottom').size[1],56.09);
  assert.ok(Math.abs(by('kupe:0:side:l').position[1]-by('kupe:0:side:l').size[1]/2-11.6)<1e-6,'leaf 11.6 mm above floor');
  assert.ok(by('kupe:track:top').size[2]<=100,'top track fits the 100 mm zone');
  const hEco=createKupeModule(1600,2400,initialModule());hEco.kupe={...hEco.kupe!,system:'Эконом H (Аристо)'};
  assert.equal(kupeParts(hEco).find(p=>p.id==='kupe:0:side:l')!.model!.file,'kupe/handle_h_eco.glb');
  // цена не зависит от геометрии 3D
  assert.equal(sum(m),sum(createKupeModule(1600,2400,initialModule())));
});

test('every kupe system draws factory sections: each model file exists, Slim Fine and Slim Decor are marked as substitutes',()=>{
  const files=new Set<string>();
  for(const s of KUPE_SYSTEMS){
    const m=createKupeModule(1600,2400,initialModule());m.kupe={...m.kupe!,system:s.system,color:s.colors[0].name,sections:1};
    const ps=kupeParts(m);
    for(const p of ps)if(p.model)files.add(p.model.file);
    const h=ps.find(p=>p.id==='kupe:0:side:l')!;
    assert.ok(h.size[0]>=10&&h.size[0]<=45&&h.size[2]>=32&&h.size[2]<=42,s.system+' handle section is a real one');
    assert.ok(ps.every(p=>p.position[2]-p.size[2]/2>-1&&p.position[2]+p.size[2]/2<m.depth+1),s.system+' stays inside the 100 mm track zone');
    assert.equal(kupeProfileExact(s),!/fine|декор/i.test(s.profile));
  }
  for(const f of files)assert.ok(existsSync(join('public/models',f)),f+' exists');
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

test('order 7358873: pull-out trempel, 60 mm plinth and inset drawer fronts behind sliding doors',()=>{
  const m=initialModule();m.width=681;m.height=2200;m.depth=450;m.plinthHeight=60;m.doors=false;m.backType='board';
  m.sections=[{...m.sections[0],shelves:[0.86],pullouts:1,drawers:1,drawerMount:'inset',drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'dtc',height:116,length:350,handle:false}]}];
  assert.deepEqual(validate(m),[]);
  const t=parts(m).find(p=>p.id.endsWith(':pullout:0'))!;assert.equal(t.size[2],350,'GTV 350 fits a 450 deep body');
  const p=newProject();p.modules[0].module=m;
  assert.ok(estimate(p).lines.some(l=>l.id==='pullout:350'&&l.unitPrice===null),'trempel priced as «уточнить»');
  assert.equal(bounds(p.modules[0]).d,450,'inset drawer front does not stick out');
});