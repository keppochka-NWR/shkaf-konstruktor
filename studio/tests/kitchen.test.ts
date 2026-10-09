import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {initialModule,validate,parts,parseModule,maxHeightOf,RULES} from '../src/model';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths,kitchenLegs} from '../src/kitchen';
import {createKitchenRow} from '../src/ModulePalette';
import {newProject,appendModuleGroup,projectErrors,parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {details} from '../src/exports';
import {partCollisions} from '../src/collisions';

const box=(p:{size:number[];position:number[]})=>p.position.map((v,i)=>[v-p.size[i]/2,v+p.size[i]/2]);

test('kitchen base follows the Bazis «Нижний модуль»: bottom under the sides on legs 100, no top, two flat rails 100, overlay HDF (W−3)×(H−3)',()=>{
  const m=kitchenBase(initialModule(),600);
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),get=(id:string)=>ps.find(p=>p.id===id)!;
  const [bx,by]=box(get('bottom'));assert.deepEqual(bx,[0,600],'bottom spans the full width');assert.deepEqual(by,[100,116],'bottom on legs 100');
  assert.equal(box(get('left'))[1][0],116,'sides stand on the bottom');
  assert.ok(!ps.some(p=>p.id==='top'),'no top panel');
  for(const id of ['rail:front-top','rail:rear-top']){const r=get(id);assert.equal(r.size[1],16,id+' lies flat');assert.equal(r.size[2],100);assert.equal(box(r)[1][1],820,id+' flush with the top');}
  const back=get('back');assert.equal(back.size[0],597);assert.equal(back.size[1],717);assert.deepEqual(box(back)[1],[101.5,818.5]);
  assert.equal(m.depth+3,560,'side 557 + HDF 3 = 560 like Bazis');
});

test('kitchen base legs: 70/70 from the bottom edges, 4 per module, clip on the front legs, plinth 38–63 mm behind the facade face',()=>{
  const m=kitchenBase(initialModule(),600),ps=parts(m);
  const legs=ps.filter(p=>p.id.startsWith('leg:'));assert.equal(legs.length,4);
  assert.deepEqual(legs.map(l=>[l.position[0],l.position[2]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),[[70,70],[70,487],[530,70],[530,487]]);
  assert.equal(ps.filter(p=>p.id.startsWith('kitchen-clip:')).length,2,'clips only on the front legs');
  const pl=ps.find(p=>p.id==='kitchen-plinth')!,face=m.depth+16,front=pl.position[2]+pl.size[2]/2;
  assert.ok(face-front>=38&&face-front<=63,'plinth face '+(face-front)+' mm behind the facades');
  assert.equal(pl.size[1],95,'plinth 95, 5 mm below the bottom');
  assert.equal(kitchenLegs({...m,width:200}).length,2,'narrow module: one row of two');
  assert.equal(kitchenLegs({...m,width:1400}).length,6,'wide module: three rows');
});

test('kitchen facades: 1.5 mm from every carcass edge and 3 mm between fronts, like the Bazis projects',()=>{
  const one=parts(kitchenBase(initialModule(),450)).filter(p=>p.role==='door').map(box);
  assert.equal(one.length,1);assert.deepEqual(one[0][0],[1.5,448.5],'single front W−3');
  const m=kitchenBase(initialModule(),800),doors=parts(m).filter(p=>p.role==='door').sort((a,b)=>a.position[0]-b.position[0]);
  assert.equal(doors.length,2);
  const [a,b]=doors.map(box);
  assert.equal(a[0][0],1.5);assert.equal(b[0][1],798.5);assert.equal(b[0][0]-a[0][1],3);
  assert.deepEqual(a[1],[101.5,818.5],'front W−3 × H−3 of the 720 body');
});

test('kitchen wall cabinet: HDF in the groove П16-4×8 — (W−18)×(H−18) at 17..20 from the rear edge, two ABS hangers',()=>{
  const m=kitchenWall(initialModule(),600);
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),back=ps.find(p=>p.id==='back')!;
  assert.equal(back.size[0],582);assert.equal(back.size[1],KITCHEN.wallHeight-18);assert.deepEqual(box(back)[2],[17,20]);
  assert.equal(ps.filter(p=>p.id.startsWith('kitchen-hanger:')).length,2);
  const e=estimate(newProject(m));
  assert.ok(e.lines.some(l=>l.id==='kitchen-hanger'&&l.quantity===2));
});

test('kitchen templates have no intersecting parts — hinges clear rails, shelves, fasteners; legs, clips and plinth fit together',()=>{
  for(const w of [300,450,600,800,900]){
    for(const m of [kitchenBase(initialModule(),w),kitchenBase(initialModule(),w,'drawers'),kitchenBase(initialModule(),w,'sink'),kitchenWall(initialModule(),w)]){
      const c=partCollisions(parts(m),m);
      assert.deepEqual(c.map(x=>`${x.names[0]} × ${x.names[1]} ${x.depth}`),[],`${m.name} ${w}`);
    }
  }
});

test('kitchen construction fields survive save and load',()=>{
  const m=kitchenWall(initialModule(),600),b=kitchenBase(initialModule(),600);
  for(const x of [m,b]){const back=parseModule(JSON.parse(JSON.stringify(x)));assert.deepEqual(parts(back),parts(x));}
});

test('worktop is a separate object priced per running metre and kept out of LDSP cutting',()=>{
  const m=kitchenWorktop(initialModule(),2400);
  assert.deepEqual(validate(m),[]);
  const p=newProject(m),e=estimate(p);
  assert.ok(e.lines.some(l=>l.id==='worktop:postforming:38'&&l.quantity===2.4&&l.unit==='пог.м'));
  assert.equal(e.ldspSheets,0);
  assert.equal(details(p).length,0,'nothing from the postforming worktop in cutting');
});

test('row widths fill the wall exactly with drawers, sink and doors; no carcass wider than 1200',()=>{
  for(const L of [900,1600,2400,3000,3170,4200,5150]){
    const ws=kitchenRowWidths(L);
    assert.equal(ws.reduce((s,w)=>s+w.width,0),L,'covers '+L);
    assert.ok(ws.every(w=>w.width>=150&&w.width<=KITCHEN.maxWidth),L+': '+ws.map(w=>w.width).join('+'));
  }
  assert.deepEqual(kitchenRowWidths(3000).map(w=>w.kind).slice(0,2),['drawers','sink']);
});

test('straight kitchen row fits a room: bases, worktop on top, wall cabinets at the regulation gap',()=>{
  const base=newProject();base.room={...base.room,width:3600,depth:3000,height:2700};
  const group=createKitchenRow(3000,initialModule());
  const r=appendModuleGroup(base,group);
  assert.deepEqual(projectErrors(r.project),[]);
  const placed=r.project.modules.filter(a=>r.ids.includes(a.id));
  const top=placed.find(a=>a.module.worktop)!;assert.equal(top.y,KITCHEN.baseHeight);
  const walls=placed.filter(a=>a.module.kitchen?.role==='wall');
  assert.ok(walls.every(a=>a.y===KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap));
  assert.ok(walls.every(a=>(a.y??0)+a.module.height<=2700));
  assert.equal(parseProject(JSON.parse(JSON.stringify(r.project))).modules.filter(a=>a.module.kitchen||a.module.worktop).length,placed.length,'kitchen fields survive save/load');
});

test('kitchen tall (пенал): height up to KITCHEN.maxHeight 2900 like Bazis (k30 m15 = 2869); wardrobe limit stays RULES.maxH 2500',()=>{
  const b=kitchenBase(initialModule(),600),k={...b,kitchen:{...b.kitchen!,role:'tall' as const}};k.height=2869;
  assert.ok(!validate(k).some(e=>e.startsWith('Высота')),'kitchen 2869 is allowed');
  k.height=2901;assert.ok(validate(k).some(e=>e.startsWith('Высота: допустимо от')),'kitchen above 2900 is rejected');
  const w=initialModule();w.height=2600;assert.ok(validate(w).some(e=>e.startsWith('Высота: допустимо от')),'wardrobe 2600 still rejected');
  assert.equal(KITCHEN.maxHeight,2900);
});

test('limit of height is one for validate and both "Высота" fields: tall 2900, other kitchen roles and wardrobes 2500 (critic n2: UI cut tall at 2500)',()=>{
  const b=kitchenBase(initialModule(),600);
  assert.equal(maxHeightOf({...b,kitchen:{...b.kitchen!,role:'tall'}}),KITCHEN.maxHeight);
  for(const role of ['base','wall','antresol'] as const){
    const m={...b,kitchen:{...b.kitchen!,role},height:2600};
    assert.equal(maxHeightOf(m),RULES.maxH,role);
    assert.ok(validate(m).some(e=>e.startsWith('Высота: допустимо от 250 до 2500')),role+' above 2500 is rejected');
  }
  assert.equal(maxHeightOf(initialModule()),RULES.maxH);
  // поля «Высота» во вкладке «Кухня» и в общей панели берут тот же предел, что validate
  const src=(f:string)=>readFileSync(fileURLToPath(new URL('../src/'+f,import.meta.url)),'utf8');
  assert.match(src('KitchenPanel.tsx'),/value=\{m\.height\} min=\{RULES\.minH\} max=\{maxHeightOf\(m\)\}/);
  assert.match(src('App.tsx'),/label="Высота"\s+value=\{m\.height\}\s+min=\{RULES\.minH\}\s+max=\{maxHeightOf\(m\)\}/);
});
