import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject} from '../src/project';
import {labelData} from '../src/exports';
import {estimate} from '../src/pricing';

const sink=()=>{const m=kitchenBase(initialModule(),800,'sink');m.facadeMaterial='external';m.rails=[{place:'front-top',height:70},{place:'rear-top',height:70,at:550}];return m;};

test('sink like Bazis k12: rear rail on edge at a given height, one confirmat per rail end',()=>{
  const ps=parts(sink()),rear=ps.find(p=>p.id==='rail:rear-top')!;
  assert.equal(rear.position[1]-rear.size[1]/2,550);
  assert.match(rear.name,/на высоте 550/);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:rail:')).length,4);
});

test('sink documents: no labels for facades of facade material, end holes by real drilling, kitchen confirmat 7×50 in the estimate',()=>{
  const p=newProject(sink()),labels=labelData(p);
  assert.ok(!labels.some(l=>/Фасад/.test(l.name)),'facades of facade material are not cut parts');
  const side=labels.find(l=>l.name==='Боковина левая')!,bottom=labels.find(l=>/Дно/.test(l.name))!;
  assert.equal(side.endHoles,'2 отв.','two D5×35 from the bottom confirmats');
  assert.equal(bottom.endHoles,'—','bottom holes go into its face');
  const e=estimate(p);
  assert.ok(e.lines.some(l=>l.id==='confirmat-7x50'));
  assert.ok(!e.lines.some(l=>l.id==='confirmat'));
});

test('Bazis kitchens: bottom under sides deeper than 600 gets a third confirmat in the middle (stat over 34 kitchens)',()=>{
  const deep=sink();deep.bottomUnder=true;deep.depth=627;deep.feet={height:100};
  const conf=(m:ReturnType<typeof sink>)=>parts(m).filter(p=>p.id.startsWith('fast:bottom:left'));
  const c3=conf(deep);
  assert.equal(c3.length,3);
  assert.ok(c3.some(p=>Math.abs(p.model!.origin![2]-627/2)<0.01),'middle one at half depth');
  const std=sink();std.bottomUnder=true;std.depth=600;std.feet={height:100};
  assert.equal(conf(std).length,2,'600 and less - two per side');
  const wardrobe=initialModule();wardrobe.depth=650;wardrobe.bottomUnder=true;
  assert.ok(!parts(wardrobe).some(p=>p.id.endsWith(':mid')),'wardrobe rules unchanged');
});

test('Bazis sinks: edge rail set back from the side edge by 1-2 mm (k14 m09, k17 m04), wardrobes ignore it',()=>{
  const m=sink();m.rails=[{place:'front-top',height:60},{place:'rear-top',height:100,setback:1}];
  const rear=parts(m).find(p=>p.id==='rail:rear-top')!;
  assert.equal(rear.position[2]-rear.size[2]/2,1);
  const w=initialModule();w.rails=[{place:'rear-top',height:100,setback:1}];
  const wr=parts(w).find(p=>p.id==='rail:rear-top')!;
  assert.equal(wr.position[2]-wr.size[2]/2,0);
});

test('recognize-common edgeRail: rear rail 1 mm from the back edge, front rail at the top',async()=>{
  const {edgeRail}=await import('../scripts/kitchen/recognize-common');
  assert.deepEqual(edgeRail({x0:16,y0:720,z0:1,x1:584,y1:820,z1:17},820,0,557),{place:'rear-top',height:100,setback:1});
  assert.deepEqual(edgeRail({x0:16,y0:760,z0:541,x1:584,y1:820,z1:557},820,0,557),{place:'front-top',height:60});
  assert.deepEqual(edgeRail({x0:16,y0:550,z0:0,x1:584,y1:620,z1:16},820,0,557),{place:'rear-top',height:70,at:550});
});
