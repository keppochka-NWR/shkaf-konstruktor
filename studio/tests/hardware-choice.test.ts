import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,slidePrice,HINGE} from '../src/pricing';
import {newProject,projectErrors,parseProject} from '../src/project';
import {parts,section,drawerConfig} from '../src/model';
import {HINGE_BRANDS,SLIDE_SYSTEMS,slideSystem,hingeCount,hingePositions,drawerHasHandle} from '../src/hardware';
import {setAllHinges,setAllSlides,setAllEdges,hardwareChoice} from '../src/hardwareSwap';

function withDrawers(){const p=newProject();const m=p.modules[0].module;m.sections=[{...section(),drawers:2},...m.sections.slice(1)];return p;}

test('hinge brand changes hinge line, price and keeps GTV ids for old projects',()=>{
  const p=newProject();p.modules[0].module.doors=true;
  const gtv=estimate(p).lines.find(l=>l.id==='hinge')!;assert.equal(gtv.unitPrice,HINGE.price);
  for(const b of ['pulse','blum'] as const){
    const q=setAllHinges(p,b),line=estimate(q).lines.find(l=>l.id==='hinge:'+b)!;
    assert.equal(line.unitPrice,HINGE_BRANDS[b].soft.price);assert.equal(line.quantity,gtv.quantity);assert.deepEqual(projectErrors(q),[]);
    assert.equal(parseProject(JSON.parse(JSON.stringify(q))).modules[0].module.hingeBrand,b,'brand survives save/open');
  }
  assert.ok(estimate(setAllHinges(p,'blum')).split.hardware>estimate(p).split.hardware);
  assert.ok(estimate(setAllHinges(p,'pulse')).split.hardware<=estimate(p).split.hardware);
  assert.deepEqual(hardwareChoice(setAllHinges(p,'blum')).hinges,['blum']);
});

test('every slide system has a price at 450 mm, push systems have no handle, old hidden configs stay DTC push',()=>{
  for(const s of SLIDE_SYSTEMS){const q=slidePrice({slide:s.slide,operation:s.motion,brand:s.brand,length:450});assert.ok(q.price!==null&&q.price>0,s.id);assert.ok(q.source.length>0);}
  assert.equal(slideSystem({slide:'gtv0fpo'}).id,'hidden-dtc-push');assert.equal(slideSystem({slide:'ball'}).id,'ball-soft');
  assert.equal(drawerHasHandle({slide:'ball',height:140,length:450,operation:'push'}),false);
  assert.equal(drawerHasHandle({slide:'gtv0fpo',height:140,length:450,operation:'soft-close',brand:'premial'}),true);
  const p=withDrawers();
  for(const s of SLIDE_SYSTEMS){
    const q=setAllSlides(p,s.id);assert.deepEqual(projectErrors(q),[],s.id);
    const m=q.modules[0].module;assert.equal(slideSystem(drawerConfig(m,m.sections[0],0)).id,s.id);
    assert.ok(estimate(q).lines.some(l=>l.id.startsWith('slide:')&&l.label.includes(s.label)),s.id+' line label');
    assert.equal(parseProject(JSON.parse(JSON.stringify(q))).modules[0].module.sections[0].drawerConfigs![0].brand,s.slide==='gtv0fpo'?s.brand:undefined);
  }
});

test('edge choice changes visible edges only and is priced by thickness',()=>{
  const p=newProject();p.modules[0].module.doors=true;
  const thin=setAllEdges(setAllEdges(p,'body',0.8),'facade',1),m=thin.modules[0].module,ps=parts(m).filter(x=>x.material==='board');
  assert.ok(ps.every(x=>!x.edge.includes(2)),'no 2 mm edge left');
  assert.ok(ps.some(x=>x.edge.includes(0.4)),'hidden 0.4 stays');
  assert.ok(ps.filter(x=>x.role==='door').every(x=>x.edge.every(e=>e===1)));
  const e=estimate(thin);assert.ok(e.lines.some(l=>l.id==='edge08'));assert.ok(e.lines.some(l=>l.id==='edge1'));assert.ok(!e.lines.some(l=>l.id==='edge2'));
  assert.ok(e.split.material<estimate(p).split.material,'thinner edge is cheaper');
  assert.deepEqual(projectErrors(thin),[]);
  const bad=structuredClone(p);(bad.modules[0].module as {edgeBody?:number}).edgeBody=3;assert.ok(projectErrors(bad).length);
});

test('hinges are drawn: cup, arm and plate per hinge, matching the priced count',()=>{
  const p=newProject();const m=p.modules[0].module;m.doors=true;
  const doors=parts(m).filter(x=>x.role==='door'&&x.hinge!=='top'&&x.id.includes(':door:'));
  const expected=doors.reduce((n,d)=>n+hingeCount(d.length,d.width),0);
  const cups=parts(m).filter(x=>x.id.includes(':hingecup:'));
  assert.equal(cups.length,expected);assert.equal(parts(m).filter(x=>x.id.includes(':hingeplate:')).length,expected);
  assert.equal(estimate(p).lines.find(l=>l.id==='hinge')!.quantity,expected);
  assert.ok(cups.every(c=>c.material==='metal'&&c.role==='hinge'));
  const pos=hingePositions(2000,500);assert.equal(pos[0],100);assert.equal(pos.at(-1),1900);
  m.doorOpen='push';assert.ok(parts(m).some(x=>x.id.includes(':latch:')),'push doors get a latch');
});
