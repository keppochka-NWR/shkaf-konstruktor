import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,parseModule,validate} from '../src/model';
import {KITCHEN,kitchenLegs} from '../src/kitchen';
import {newProject,parseProject,projectErrors,applyAutoFillers,bounds,type Project} from '../src/project';
import {partCollisions} from '../src/collisions';
import {kitchenProject,isKitchenProject,kitchenTemplate,placeKitchenModule,placeWorktop,placeKitchenRow,setLegHeight,legModules,rebuildKitchen,kitchenItemOf,addHinge,removeHinge,KITCHEN_ITEMS,KITCHEN_ROOM,KITCHEN_WALL_OFFSET,type KitchenItem} from '../src/kitchenProject';

/** Тем же путём, что commitProject в App: автофальши, затем ошибки проекта. */
const commitErrors=(p:Project)=>projectErrors(applyAutoFillers(p));
const look={decor:'Белый',facadeDecor:'Белый'};

test('kitchen tab project: room 3600×3000×2700, straight row 3000 from the wall offset, commits clean',()=>{
  const p=kitchenProject();
  assert.equal(p.kind,'kitchen');assert.ok(isKitchenProject(p));
  assert.deepEqual([p.room.width,p.room.depth,p.room.height],[KITCHEN_ROOM.width,KITCHEN_ROOM.depth,KITCHEN_ROOM.height]);
  assert.deepEqual(commitErrors(p),[]);
  const bases=p.modules.filter(a=>a.module.kitchen?.role==='base'),walls=p.modules.filter(a=>a.module.kitchen?.role==='wall'),tops=p.modules.filter(a=>a.module.worktop);
  assert.equal(bases.reduce((s,a)=>s+a.module.width,0),3000);assert.equal(walls.length,bases.length);assert.equal(tops.length,1);
  assert.equal(Math.min(...bases.map(a=>a.x)),KITCHEN_WALL_OFFSET,'room for the wall filler 16 + 5');
  assert.ok(!applyAutoFillers(p).modules.find(a=>a.module.worktop)!.module.wallFiller,'worktop carries no wall filler');
  assert.ok(!isKitchenProject(newProject()),'ordinary project is not a kitchen');
});

test('project kind survives save/load; unknown kind is rejected',()=>{
  const p=kitchenProject(),back=parseProject(JSON.parse(JSON.stringify(p)));
  assert.equal(back.kind,'kitchen');assert.equal(back.modules.length,p.modules.length);
  assert.equal(parseProject(JSON.parse(JSON.stringify(newProject()))).kind,undefined);
  assert.throws(()=>parseProject({...JSON.parse(JSON.stringify(p)),kind:'garage'}),/тип проекта/);
});

test('every palette item validates and has no intersecting parts (bottle 150 included)',()=>{
  for(const k of Object.keys(KITCHEN_ITEMS) as KitchenItem[])for(const w of KITCHEN_ITEMS[k].widths){
    const m=kitchenTemplate(k,w,look);
    assert.deepEqual(validate(m),[],`${k} ${w}`);
    assert.deepEqual(partCollisions(parts(m),m).map(c=>c.names.join(' × ')),[],`${k} ${w}`);
    assert.equal(kitchenItemOf(m),k,'palette item is recognised back for the «Назначение» select');
  }
  const bottle=kitchenTemplate('bottle',150,look);
  assert.equal(bottle.width,150);assert.equal(kitchenLegs(bottle).length,2,'narrow module: one pair of legs in the middle');
});

test('tall cabinet: top flush with wall cabinets, lower front flush with base fronts',()=>{
  const m=kitchenTemplate('tall',600,look),doors=parts(m).filter(p=>p.role==='door').sort((a,b)=>a.position[1]-b.position[1]);
  assert.equal(m.height,KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap+KITCHEN.wallHeight);
  assert.equal(doors.length,2);
  assert.equal(doors[0].position[1]+doors[0].size[1]/2,818.5,'lower front ends like the base fronts');
  assert.equal(m.sections[0].shelves.length,4);
});

test('palette placement: base continues the floor row, wall cabinet joins the wall row, all commit clean',()=>{
  const p=kitchenProject();
  const b=placeKitchenModule(p,kitchenTemplate('base-doors',450,look)),a=b.project.modules.find(x=>x.id===b.id)!;
  assert.deepEqual(commitErrors(b.project),[]);
  assert.equal(a.y,0);assert.equal(bounds(a).z,0,'back face (with HDF) against the wall');assert.equal(a.x,KITCHEN_WALL_OFFSET+3000,'right after the row');
  const w=placeKitchenModule(p,kitchenTemplate('wall',450,look)),wa=w.project.modules.find(x=>x.id===w.id)!;
  assert.deepEqual(commitErrors(w.project),[]);
  assert.equal(wa.y,KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap);
  // справа от ряда 558 мм до стены: пенал 450 встаёт, 600 — понятная ошибка вместо пересечения
  assert.deepEqual(commitErrors(placeKitchenModule(p,kitchenTemplate('tall',450,look)).project),[]);
  assert.throws(()=>placeKitchenModule(p,kitchenTemplate('tall',600,look)),/Нет места/);
  // антресоль над навесными 920 в комнату 2700 не помещается — понятная ошибка; над навесными 720 — встаёт сверху
  assert.throws(()=>placeKitchenModule(p,kitchenTemplate('antresol',600,look)),/не помещается/);
  const low={...p,modules:p.modules.map(x=>x.module.kitchen?.role==='wall'?{...x,module:{...x.module,height:720}}:x)};
  const r=placeKitchenModule(low,kitchenTemplate('antresol',600,look)),ra=r.project.modules.find(x=>x.id===r.id)!;
  assert.equal(ra.y,KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap+720);assert.deepEqual(commitErrors(r.project),[]);
});

test('worktop over uncovered bases; straight row replaces the kitchen or continues it',()=>{
  const p=kitchenProject();
  assert.throws(()=>placeWorktop(p,look),/уже под столешницей/);
  const bare={...p,modules:p.modules.filter(a=>!a.module.worktop)},w=placeWorktop(bare,look),top=w.project.modules.find(a=>a.module.worktop)!;
  assert.deepEqual([top.x,top.y,top.module.width],[KITCHEN_WALL_OFFSET,KITCHEN.baseHeight,3000]);assert.deepEqual(commitErrors(w.project),[]);
  const r=placeKitchenRow(p,2400,look,true);
  assert.deepEqual(commitErrors(r.project),[]);
  assert.equal(r.project.modules.filter(a=>a.module.kitchen?.role==='base').reduce((s,a)=>s+a.module.width,0),2400,'old row replaced');
  const wide={...p,room:{...p.room,width:6600}},add=placeKitchenRow(wide,2400,look);
  assert.deepEqual(commitErrors(add.project),[]);assert.equal(add.project.modules.length,p.modules.length+add.ids.length);
});

test('leg height for the whole kitchen: body stays 720, plinth follows (5 below the bottom), worktop rises with the bases',()=>{
  const p=kitchenProject(),n=setLegHeight(p,legModules(p),120);
  assert.deepEqual(commitErrors(n),[]);
  for(const a of n.modules.filter(x=>x.module.kitchen?.role==='base')){
    assert.equal(a.module.feet!.height,120);assert.equal(a.module.height,840);
    const pl=parts(a.module).find(q=>q.id==='kitchen-plinth');if(pl)assert.equal(pl.size[1],115);
  }
  assert.equal(n.modules.find(a=>a.module.worktop)!.y,840);
  const back=parseProject(JSON.parse(JSON.stringify(n)));assert.equal(back.modules.find(a=>a.module.worktop)!.y,840);
});

test('leg offset from the ends (legs.side) survives save/load and moves the legs',()=>{
  const m=kitchenTemplate('base-doors',600,look);m.kitchen={...m.kitchen!,legs:{back:70,front:60,side:120}};
  assert.deepEqual(validate(m),[]);
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.legs,{back:70,front:60,side:120});
  assert.deepEqual([...new Set(kitchenLegs(back).map(l=>l.x))],[120,480]);
});

test('rebuild keeps width, colours and hinges; manual hinge list grows and shrinks from the middle',()=>{
  const m={...kitchenTemplate('base-doors',600,look),hingeBrand:'blum' as const,facadeDecor:'Графит'};
  const r=rebuildKitchen(m,'sink');
  assert.equal(kitchenItemOf(r),'sink');assert.equal(r.width,600);assert.equal(r.hingeBrand,'blum');assert.equal(r.facadeDecor,'Графит');
  assert.deepEqual(addHinge([100,617]),[100,359,617]);
  assert.deepEqual(removeHinge([100,359,617],717),[100,617]);
  assert.deepEqual(removeHinge([100,617],717),[100,617],'two hinges stay');
});
