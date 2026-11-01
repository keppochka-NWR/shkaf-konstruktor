// Макс 01.11: выкатные ящики в угловом шкафу. Геометрия блоков: короб внутри корпуса, фасад на коробе, ход по нормали фасада, при выдвижении
// ни во что не упирается; центр угла и антресоль — запрет с причиной; смета и детали совпадают с моделью.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCornerModule,createCornerUpper,cornerDrawerBlock,fitCornerFilling} from '../src/cornerWardrobe';
import {parts,validate,type Module,type Part} from '../src/model';
import {partCollisions} from '../src/collisions';
import {newProject} from '../src/project';
import {insertItem,transferPart,clearSection} from '../src/operations';
import {addMenuItem} from '../src/addMenu';
import {estimate} from '../src/pricing';
import {details,nest} from '../src/exports';
import type {RadialItem} from '../src/RadialMenu';

const SIZES:[number,number][]=[[950,400],[950,450],[1050,400],[1050,450],[1050,600],[1110,450],[1110,600],[1200,500],[1400,650]];
const T=16;
/** Углы детали в плане — как меш в Scene: rotation.y → x'=x·cos+z·sin, z'=−x·sin+z·cos. */
function plan(p:Part){const a=(p.rotY??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [-1,1].flatMap(i=>[-1,1].map(k=>{const x=i*p.size[0]/2,z=k*p.size[2]/2;return [p.position[0]+x*c+z*s,p.position[2]-x*s+z*c] as [number,number];}));}
/** Ход ящика в Scene: dp=(sin rotY, 0, cos rotY) — нормаль лица фасада. */
const dir=(p:Part)=>{const a=(p.rotY??0)*Math.PI/180;return [Math.sin(a),Math.cos(a)] as const;};
const drawer=(m:Module,sid:string,j:number)=>parts(m).filter(p=>p.id.startsWith(`${sid}:drawer:${j}:`));
const by=(ps:Part[],tail:string)=>ps.find(p=>p.id.endsWith(':'+tail))!;
const moved=(p:Part,by_:number):Part=>{const [dx,dz]=dir(p);return {...p,id:p.id+':open',position:[p.position[0]+dx*by_,p.position[1],p.position[2]+dz*by_]};};
function hidden(m:Module){for(const s of m.sections.slice(0,2))s.drawerConfigs=s.drawerConfigs?.map(d=>({...d,slide:'gtv0fpo'}));return m;}
const each=(fn:(m:Module,label:string)=>void)=>{for(const [w,d] of SIZES){fn(createCornerModule(w,2000,d),`${w}/${d} шариковые`);fn(hidden(createCornerModule(w,2000,d)),`${w}/${d} скрытые`);}};

test('весь заявленный диапазон строится: сторона 950–1400, боковина 400–650; эталон 1050/450 не меняется',()=>{
 each((m,l)=>assert.deepEqual(validate(m),[],l));
 const base=createCornerModule(1050,2000,450);assert.equal(base.corner!.bayDepth,400);assert.equal(base.corner!.slideLength,350);assert.equal(base.sections[0].drawerConfigs![0].length,350);
 const thin=createCornerModule(1050,2000,400);assert.ok(thin.corner!.bayDepth<=400-T-10);assert.ok(thin.sections[0].drawerConfigs!.every(d=>d.length+30<=thin.corner!.bayDepth));
 const keep=createCornerModule(1200,2000,500);keep.corner!.bayDepth=350;keep.sections[0].drawerConfigs![0].length=300;fitCornerFilling(keep);assert.equal(keep.corner!.bayDepth,350);assert.equal(keep.sections[0].drawerConfigs![0].length,300);
});

test('короб, фасад и направляющие закрытого ящика — внутри контура корпуса',()=>{
 each((m,l)=>{
  const w=m.width,d=m.corner!.sideDepth,ps=parts(m),bottom=ps.find(p=>p.id==='bottom')!,mid=ps.find(p=>p.id==='middle-shelf')!;
  for(const p of ps.filter(p=>p.id.includes(':drawer:')||p.id.endsWith(':drawer-cap'))){
   for(const [x,z] of plan(p)){
    assert.ok(x>=-.01&&z>=-.01&&x<=w-T+.01&&z<=w-T+.01,`${l}: ${p.name} вне стенок: ${x},${z}`);
    assert.ok(x+z<=w+d-T+.01,`${l}: ${p.name} за диагональю дверей: ${x+z} > ${w+d-T}`);
   }
   assert.ok(p.position[1]-p.size[1]/2>=bottom.position[1]+T/2-.01&&p.position[1]+p.size[1]/2<=mid.position[1]-T/2+.01,`${l}: ${p.name} вне отделения по высоте`);
  }
 });
});

test('фасад на своём коробе, ход по нормали фасада, направляющие вдоль хода',()=>{
 each((m,l)=>{
  for(const [i,side] of [[0,'левый'],[1,'правый']] as const){
   const s=m.sections[i];
   for(let j=0;j<s.drawers;j++){
    const ps=drawer(m,s.id,j),face=by(ps,'facade'),front=by(ps,'front'),rear=by(ps,'rear'),bottom=by(ps,'bottom');
    assert.equal(new Set(ps.map(p=>p.rotY??0)).size,1,`${l} ${side}: все детали ящика повёрнуты одинаково`);
    assert.deepEqual(dir(face).map(v=>Math.round(v)),i===0?[1,0]:[0,1],`${l} ${side}: левый блок едет по +X, правый по +Z — вдоль своей боковины`);
    const [nx,nz]=dir(face),along=(p:Part)=>p.position[0]*nx+p.position[2]*nz,across=(p:Part)=>p.position[0]*nz-p.position[2]*nx;
    assert.ok(Math.abs(across(face)-across(bottom))<.01,`${l} ${side}: фасад по центру короба`);
    const gap=(along(face)-T/2)-(along(front)+T/2);assert.ok(gap>=0&&gap<=2,`${l} ${side}: фасад вплотную к передней стенке, зазор ${gap}`);
    assert.ok(along(front)>along(rear),`${l} ${side}: передняя стенка ближе к выходу`);
    assert.ok(face.position[1]-face.size[1]/2<=bottom.position[1]-T/2&&face.position[1]+face.size[1]/2>=front.position[1]+front.size[1]/2,`${l} ${side}: фасад закрывает короб по высоте`);
    assert.ok(face.size[0]>=bottom.size[0],`${l} ${side}: фасад не уже короба`);
    for(const r of ps.filter(p=>p.id.includes(':slide:'))){assert.ok(r.size[2]>r.size[0],'длинная ось направляющей — по ходу');assert.ok(Math.abs(along(r)+r.size[2]/2-(along(front)+T/2))<.01,`${l} ${side}: передний торец направляющей у передней стенки`);}
   }
  }
 });
});

test('нет пересечений деталей: ни закрытый шкаф (раньше 12 ложных на каждый угловой), ни выдвинутый ящик',()=>{
 each((m,l)=>{
  const ps=parts(m);assert.deepEqual(partCollisions(ps,m).map(c=>c.names.join(' × ')+' '+c.depth),[],l);
  const w=m.width,hinge=(leaf:Part)=>{const sign=leaf.hinge==='right'?-1:1,a=45*Math.PI/180,open=45-sign*.58*180,o=open*Math.PI/180,px=leaf.position[0]-sign*leaf.size[0]/2*Math.cos(a),pz=leaf.position[2]+sign*leaf.size[0]/2*Math.sin(a);return {...leaf,rotY:open,position:[px+sign*leaf.size[0]/2*Math.cos(o),leaf.position[1],pz-sign*leaf.size[0]/2*Math.sin(o)]} as Part;};
  for(const i of [0,1]){
   const s=m.sections[i],other=m.sections[1-i];
   for(let j=0;j<s.drawers;j++){
    const cfg=s.drawerConfigs![j],out=drawer(m,s.id,j).filter(p=>!p.id.includes(':slide:')).map(p=>moved(p,cfg.length)),rest=ps.filter(p=>!p.id.startsWith(`${s.id}:drawer:${j}:`)).map(p=>p.role==='door'?hinge(p):p);
    const hits=partCollisions([...out,...rest],m).filter(c=>c.a.endsWith(':open')!==c.b.endsWith(':open'));
    assert.deepEqual(hits.map(c=>c.names.join(' × ')+' '+c.depth),[],`${l}: ящик ${j+1} выдвинут на ${cfg.length}, створки открыты, встречный блок ${other.id===m.sections[1].id?'правый':'левый'} закрыт`);
    assert.ok(out.every(p=>plan(p).every(([x,z])=>i===0?z<=w-T+.01:x<=w-T+.01)),`${l}: ящик идёт вдоль боковины, наружу за неё не выходит`);
   }
  }
 });
});

const find=(items:RadialItem[],id:string):RadialItem|undefined=>{for(const x of items){if(x.id===id)return x;const c=x.children&&find(x.children,id);if(c)return c;}return undefined;};
const ops={drop:()=>{},modify:()=>{},split:()=>{},openKitchen:()=>{}} as unknown as Parameters<typeof addMenuItem>[2];

test('центр угла и антресоль: ящик серый с причиной, операции — та же причина',()=>{
 const p0=newProject(createCornerModule(1110,2000,600)),m=p0.modules[0].module,mid=p0.modules[0].id,[left,right,centre]=m.sections;
 for(const s of [left,right]){assert.equal(cornerDrawerBlock(m,s),undefined);const it=find(addMenuItem(m,s.id,ops).children!,'add-drawer')!;assert.ok(!it.disabled);assert.doesNotMatch(it.hint!,/45°/);}
 const it=find(addMenuItem(m,centre.id,ops).children!,'add-drawer')!;assert.equal(it.disabled,true);assert.match(it.hint!,/45°/);
 assert.throws(()=>insertItem(p0,'drawer',mid,centre.id,300),/45°/);
 assert.throws(()=>transferPart(p0,mid,left.id,left.id+':drawer:0:bottom',mid,centre.id,300),/45°/);
 assert.equal(clearSection(p0,mid,left.id).modules[0].module.sections[0].drawers,0);
 const bad=structuredClone(m);bad.sections[2].drawers=1;bad.sections[2].drawerConfigs=[{slide:'ball',height:190,length:350}];assert.match(validate(bad).join(' '),/45°/);
 const up=createCornerUpper(m,400);assert.match(cornerDrawerBlock(up,up.sections[0])!,/антресоли/);assert.equal(find(addMenuItem(up,up.sections[0].id,ops).children!,'add-drawer')!.disabled,true);
 assert.deepEqual(validate(up),[]);
});

test('смета и детали считают ровно то, что нарисовано',()=>{
 for(const count of [3,2,0]){
  const m=createCornerModule(1110,2000,600);for(const s of m.sections.slice(0,2)){s.drawers=count;s.drawerConfigs=s.drawerConfigs!.slice(0,count);}
  m.sections[1].drawerConfigs?.forEach(d=>{d.length=300;});
  assert.deepEqual(validate(m),[]);
  const p=newProject(m),e=estimate(p,nest(p)),ps=parts(m),n=(id:string)=>e.lines.filter(l=>l.id===id).reduce((a,l)=>a+l.quantity,0);
  assert.equal(n('slide:ball:350'),count,'комплект на ящик левого блока');assert.equal(n('slide:ball:300'),count,'комплект на ящик правого блока');
  assert.equal(ps.filter(q=>q.id.includes(':slide:')).length,count*2*2,'в модели по 2 направляющие на ящик');
  const cut=details(p).filter(d=>d.id.includes(':drawer:'));
  assert.equal(cut.filter(d=>d.material==='board').length,count*2*6,'6 деталей ЛДСП на ящик: 2 боковины, 2 поперечины, дно, фасад');
  for(const d of cut.filter(d=>d.material==='board')){const q=ps.find(x=>x.id===d.id)!;assert.deepEqual([d.length,d.width,d.thickness],[q.length,q.width,q.thickness]);}
 }
 const m=createCornerModule(1110,2000,600);m.sections[0].drawerConfigs![0].noFacade=true;
 assert.equal(drawer(m,m.sections[0].id,0).some(p=>p.id.endsWith(':facade')),false,'ящик без фасада');assert.deepEqual(validate(m),[]);
});
