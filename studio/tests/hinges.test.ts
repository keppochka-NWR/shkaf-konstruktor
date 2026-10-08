import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,section,type Module} from '../src/model';
import {createModule} from '../src/ModulePalette';
import {partCollisions,hingeCollisions,partPenetration} from '../src/collisions';
import {kitchenHingeCount,hingePositions} from '../src/hardware';

const hinges=(m:Module)=>parts(m).filter(p=>p.id.includes(':hingecup:'));

test('a hinge never sits on a shelf: it moves to the nearest free height instead of crossing the shelf (Max 09.10.2026)',()=>{
  const m:Module={...initialModule(),width:500,height:2000,depth:550,sections:[section()]};
  const door=parts(m).find(p=>p.role==='door')!,y0=door.position[1]-door.size[1]/2;
  // полка ровно на высоте первой петли (100 мм от низа фасада): подбираем долю высоты, при которой центр полки там
  const shelfY=(f:number)=>parts({...m,sections:[{...m.sections[0],shelves:[f]}]}).find(p=>p.role==='shelf'&&p.material==='board')!.position[1];
  let shelfAt=0.05;for(let f=0.01;f<0.5;f+=0.0005)if(Math.abs(shelfY(f)-(y0+100))<Math.abs(shelfY(shelfAt)-(y0+100)))shelfAt=f;
  const withShelf:Module={...m,sections:[{...m.sections[0],shelves:[shelfAt]}]};
  const ps=parts(withShelf),shelf=ps.find(p=>p.role==='shelf'&&p.material==='board')!;
  assert.ok(Math.abs(shelf.position[1]-(y0+100))<20,'shelf placed in the hinge zone');
  assert.deepEqual(hingeCollisions(partCollisions(ps,withShelf)),[],'no hinge collisions');
  const cups=ps.filter(p=>p.id.includes(':hingecup:')),plates=ps.filter(p=>p.id.includes(':hingeplate:'));
  for(const h of [...cups,...plates])assert.ok(partPenetration(h,shelf)<=0.1,h.id+' clears the shelf');
  assert.equal(cups.length,hinges(m).length,'hinge count unchanged');
});

test('the hinge plate sits on the real stand face — never floating inside the carcass or buried in the side',()=>{
  for(const mount of ['overlay','inset'] as const){
    const m:Module={...initialModule(),width:600,height:2000,depth:550,doorMount:mount,sections:[section()]};
    const ps=parts(m),left=ps.find(p=>p.id==='left')!,inner=left.position[0]+left.size[0]/2;
    for(const pl of ps.filter(p=>p.id.includes(':hingeplate:')&&p.position[0]<m.width/2))
      assert.ok(Math.abs(pl.position[0]-pl.size[0]/2-inner)<0.01,`${mount}: plate on the side face (${pl.position[0]-pl.size[0]/2} vs ${inner})`);
  }
});

test('palette wardrobes have zero hinge collisions',()=>{
  for(const k of ['empty','wardrobe','corner'] as const){
    const m=createModule(k,k==='corner'?1050:900,2200,k==='corner'?450:600,initialModule());
    assert.deepEqual(hingeCollisions(partCollisions(parts(m),m)).map(c=>c.names.join(' × ')),[],k);
  }
});

test('kitchen hinge count follows the Bazis projects: by front height only',()=>{
  assert.deepEqual([600,900,901,1300,1301,1700,2100,2400].map(kitchenHingeCount),[2,2,3,3,4,4,5,6]);
  assert.deepEqual(hingePositions(717,600,true),[100,617],'100 mm from both edges');
  assert.equal(hingePositions(717,600).length,3,'wardrobe rule unchanged: +1 hinge wider than 450');
});
