import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,parseModule,validate,boxes,legCount,shelfGaps,type Module} from '../src/model';
import {splitOpening,resizeOpening,resolveLayout,rekeySections,mirrorOpenings,removeOpening,setPartition} from '../src/sectionLayout';
import {newProject,projectErrors,applyAutoFillers} from '../src/project';
import {movePart,removePart} from '../src/operations';
import {persistProject,CURRENT_PROJECT} from '../src/projectStorage';
function wardrobe():Module{
  const m={...initialModule(),width:1050,height:2000,depth:600,doors:false,openJunction:true,plinthHeight:80,sections:[{id:'narrow',weight:1,shelves:[],drawers:0,rod:false}]} as Module;
  splitOpening(m,'narrow','x',300,'stack');splitOpening(m,'stack','y',600,'shared');splitOpening(m,'stack','x',343,'stack2');
  for(const s of m.sections){s.drawerMount='inset';if(s.id.startsWith('stack')){s.drawers=3;s.drawerGap=3;s.drawerConfigs=[0,200,400].map(y=>({slide:'gtv0fpo',length:500,height:160,facadeH:197,y,handle:false,operation:'soft-close'}));}}
  const shared=m.sections.find(s=>s.id==='shared')!;shared.drawers=1;shared.drawerConfigs=[{slide:'gtv0fpo',length:500,height:50,facadeH:50,y:22,tray:true,handle:false}];shared.shelves=[110/1272];shared.glassShelves=[0];shared.rod=true;shared.rodAt=1188/1272;
  return m;
}
test('partial partitions leave shared hanging zone; one common cap over six drawers',()=>{
  const m=wardrobe();assert.deepEqual(validate(m),[]);const geometry=parts(m),layout=resolveLayout(m);
  assert.equal(layout.panels.filter(p=>p.axis==='x'&&p.height===600).length,1);
  assert.equal(layout.panels.filter(p=>p.axis==='y'&&p.width===702).length,1);
  assert.equal(geometry.filter(p=>p.id.endsWith(':drawer-cap')).length,0);
  assert.equal(geometry.filter(p=>p.id.endsWith(':facade')).length,7);
  assert.equal(geometry.find(p=>p.role==='rod')!.size[0],702);
  assert.deepEqual(parts(parseModule(JSON.parse(JSON.stringify(m)))),geometry);
});
test('native drawers and glass shelf respond to normal editing operations',()=>{
  const p=newProject(wardrobe()),mid=p.modules[0].id,old=parts(p.modules[0].module).find(p=>p.id==='shared:shelf:0')!;
  const n=movePart(p,mid,'shared','shared:shelf:0',20);assert.deepEqual(projectErrors(n),[]);
  const changed=parts(n.modules[0].module).find(p=>p.id==='shared:shelf:0')!;assert.equal(changed.material,'glass');assert.equal(changed.position[1]-old.position[1],20);
  const removed=removePart(n,mid,'shared','shared:shelf:0');assert.deepEqual(projectErrors(removed),[]);assert.equal(parts(removed.modules[0].module).filter(p=>p.material==='glass').length,0);
});
test('resize, mirror twice and rekey preserve partition identity and geometry',()=>{
  const m=wardrobe(),original=boxes(m);resizeOpening(m,'stack',350);assert.equal(boxes(m).find(b=>b.id==='stack')!.width,350);assert.equal(boxes(m).find(b=>b.id==='stack2')!.width,336);
  mirrorOpenings(m);mirrorOpenings(m);assert.equal(boxes(m).find(b=>b.id==='narrow')!.x,original[0].x);
  let i=0;rekeySections(m,()=>`new-${++i}`);assert.deepEqual(validate(m),[]);assert.ok(boxes(m).every(b=>b.id.startsWith('new-')));
});
test('invalid split and malformed imported tree are rejected',()=>{
  const m=wardrobe();(m.sectionLayout as any).at=-1;assert.ok(validate(m).length);assert.throws(()=>parseModule(m));
  const n=wardrobe();(n.sectionLayout as any).first={section:'missing'};assert.ok(validate(n).length);
});
test('removing a zone merges only its sibling and preserves the upper hanging zone',()=>{
  const m=wardrobe();m.sections.find(s=>s.id==='stack2')!.drawers=0;delete m.sections.find(s=>s.id==='stack2')!.drawerConfigs;
  removeOpening(m,'stack2');assert.equal(boxes(m).find(b=>b.id==='stack')!.width,702);assert.equal(boxes(m).find(b=>b.id==='shared')!.width,702);assert.deepEqual(validate(m),[]);
});
test('raised inset drawer keeps its short facade and permits a shelf below',()=>{
  const m={...initialModule(),doors:false,height:2000,width:470,plinthHeight:80} as Module,s=m.sections[0];s.drawerMount='inset';s.drawers=1;s.drawerConfigs=[{slide:'gtv0fpo',length:500,height:160,facadeH:197,y:482.5,handle:false}];s.shelves=[284/1888];
  assert.deepEqual(validate(m),[]);const f=parts(m).find(p=>p.id.endsWith(':facade'))!;assert.equal(f.size[1],197);assert.ok(f.position[1]-f.size[1]/2>500);
});
test('short clothes clearance is explicit and impossible rod placement still fails',()=>{
  const m={...initialModule(),doors:false,height:2000,width:470,plinthHeight:80} as Module,s=m.sections[0];s.drawers=0;s.shelves=[.3];s.rod=true;s.rodAt=.6;s.rodClearance=450;
  assert.deepEqual(validate(m),[]);s.rodClearance=900;assert.ok(validate(m).some(e=>e.includes('900')));
});
test('open junction is stable across ordinary edits and automatic fillers',()=>{
  const p=newProject(wardrobe());assert.deepEqual(applyAutoFillers(p),p);
});
test('project link autosave cannot overwrite the regular project',()=>{
  const memory=new Map([[CURRENT_PROJECT,'original']]),storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v);}};
  const key=CURRENT_PROJECT+':linked';persistProject(storage,newProject(),undefined,null,key);assert.equal(memory.get(CURRENT_PROJECT),'original');assert.ok(memory.has(key));assert.throws(()=>persistProject(storage,newProject(),undefined,null,key));
});
test('floor-standing wardrobe sides reach floor; only the bottom is raised over the plinth',()=>{
  const m=wardrobe(),ps=parts(m);
  for(const id of ['left','right']){const p=ps.find(p=>p.id===id)!;assert.equal(p.position[1]-p.size[1]/2,0);assert.equal(p.length,2000);}
  const base=ps.find(p=>p.id==='bottom')!;assert.equal(base.position[1]-base.size[1]/2,80);
  const plinth=ps.find(p=>p.id==='plinth')!;assert.equal(plinth.size[0],1018);assert.equal(plinth.position[1]-plinth.size[1]/2,0);
  assert.equal(legCount(m,0),6);assert.equal(legCount({...m,width:470},0),4);assert.equal(legCount({...m,height:640,plinthHeight:0},2000),0);
});
test('moving shared horizontal partition preserves tray and glass clearance',()=>{
  const m=wardrobe(),s=m.sections.find(s=>s.id==='shared')!,before=parts(m).find(p=>p.id==='shared:shelf:0')!;
  setPartition(m,'split-shared',620);assert.deepEqual(validate(m),[]);
  const after=parts(m).find(p=>p.id==='shared:shelf:0')!;assert.equal(after.position[1]-before.position[1],20);
  assert.ok(shelfGaps(m,s.id).every(g=>g.height>=0));
});
