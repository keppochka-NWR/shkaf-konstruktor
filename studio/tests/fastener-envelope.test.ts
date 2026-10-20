import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import * as THREE from 'three';
import {parts,initialModule,CONFIRMAT_QUATS,type Module,type Part} from '../src/model';
import {parseProject} from '../src/project';
import {createModule,type ModuleKind} from '../src/ModulePalette';
import {kitchenBase,kitchenWall} from '../src/kitchen';
import {kitchenProject,kitchenTall} from '../src/kitchenProject';
import {fastenerGeometry,hingeFallbackModel,procModel,faceAt,nativePlacement} from '../src/hardwareModels';

// Баг Макса по демо 20.10.2026: «крепёж торчит над шкафом» — штыри над крышей, дном и полками. Причина: у крепежа с сеткой Базиса
// (model.native) меш не поворачивается, и заглушка-цилиндр стояла по Y всегда; когда сетка не грузилась, горизонтальный конфирмат
// 7×50 в крыше рисовался вертикальным штырём на 17 мм над плитой. Здесь: (1) заглушка лежит в габарите своей детали; (2) крепёж
// студии — сетка Базиса (GLB из public/models), процедурная модель или габарит — не выходит за корпус больше 0,5 мм, кроме того,
// что снаружи по конструкции (опоры, клипсы цоколя, навесы, крепёж на фасаде); (3) запасная модель петли — в габарите сетки.

type V3=[number,number,number];
const qmul=(a:number[],b:number[])=>{const [aw,ax,ay,az]=a,[bw,bx,by,bz]=b;return [aw*bw-ax*bx-ay*by-az*bz,aw*bx+ax*bw+ay*bz-az*by,aw*by-ax*bz+ay*bw+az*bx,aw*bz+ax*by-ay*bx+az*bw];};
const rot=(q:number[],v:number[])=>{const [w,x,y,z]=q;return qmul(qmul(q,[0,...v]),[w,-x,-y,-z]).slice(1) as V3;};
/** Габарит GLB по accessor min/max и узлам сцены (без загрузчика three — в node нет fetch файлов). */
const glbCache=new Map<string,{lo:V3;hi:V3}|null>();
function glbBox(file:string){
  if(glbCache.has(file))return glbCache.get(file)!;
  const path=join('public/models',file);
  if(!existsSync(path)){glbCache.set(file,null);return null;}
  const b=readFileSync(path),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  const lo:V3=[Infinity,Infinity,Infinity],hi:V3=[-Infinity,-Infinity,-Infinity];
  const visit=(ni:number,q:number[],t:number[],s:number[])=>{const n=json.nodes[ni];
    const nq=n.rotation?[n.rotation[3],n.rotation[0],n.rotation[1],n.rotation[2]]:[1,0,0,0],nt=n.translation??[0,0,0],ns=n.scale??[1,1,1];
    const ct=rot(q,nt.map((v:number,i:number)=>v*s[i])).map((v,i)=>v+t[i]),cq=qmul(q,nq),cs=s.map((v,i)=>v*ns[i]);
    if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const a=json.accessors[p.attributes.POSITION];
      for(const x of [a.min[0],a.max[0]])for(const y of [a.min[1],a.max[1]])for(const z of [a.min[2],a.max[2]]){const v=rot(cq,[x*cs[0],y*cs[1],z*cs[2]]).map((c,i)=>c+ct[i]);for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],v[i]);hi[i]=Math.max(hi[i],v[i]);}}}
    for(const c of n.children??[])visit(c,cq,ct,cs);};
  for(const r of json.scenes[json.scene??0].nodes)visit(r,[1,0,0,0],[0,0,0],[1,1,1]);
  const r={lo,hi};glbCache.set(file,r);return r;
}
/** Габарит локальной коробки (lo..hi) после поворота q и переноса в o. */
function placed(lo:V3,hi:V3,q:number[],o:V3,mirror=false){
  const a:V3=[Infinity,Infinity,Infinity],b:V3=[-Infinity,-Infinity,-Infinity];
  for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]]){const v=rot(q,[mirror?-x:x,y,z]).map((c,i)=>c+o[i]);for(let i=0;i<3;i++){a[i]=Math.min(a[i],v[i]);b[i]=Math.max(b[i],v[i]);}}
  return {lo:a,hi:b};
}
const box3=(o:THREE.Object3D)=>{o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);};
/** Что видно на сцене: сетка Базиса — по origin/quat; процедурная модель — вокруг центра детали; иначе — габарит детали. */
function visual(p:Part,ps:Part[],m:Module){
  if(p.model?.native&&p.model.file){const g=glbBox(p.model.file);if(g)return placed(g.lo,g.hi,p.model.quat??[1,0,0,0],(p.model.origin??p.position) as V3,!!p.model.mirror);}
  const byId=new Map(ps.map(q=>[q.id,q]));
  const headSign=p.id.startsWith('ecc:')&&p.id.endsWith(':pin')?(()=>{const cam=byId.get(p.id.slice(0,-4)),ax=p.size.indexOf(Math.max(...p.size));return cam&&cam.position[ax]<p.position[ax]?-1 as const:1 as const;})():undefined;
  const g=procModel(p,{left:p.position[0]<m.width/2,headSign,face:(p.id.includes(':screw:')||p.id.startsWith('kitchen-leg-screw:'))&&Math.max(...p.size)<=5?faceAt(p.position,ps):undefined});
  if(g){const b=box3(g);return {lo:[b.min.x+p.position[0],b.min.y+p.position[1],b.min.z+p.position[2]] as V3,hi:[b.max.x+p.position[0],b.max.y+p.position[1],b.max.z+p.position[2]] as V3};}
  return {lo:p.position.map((c,i)=>c-p.size[i]/2) as V3,hi:p.position.map((c,i)=>c+p.size[i]/2) as V3};
}
// снаружи корпуса по конструкции: опоры и их саморезы, клипсы цоколя, навесы с заглушками, крепёж на фасаде (газлифт к фасаду), ножки
// и стяжка с соседним корпусом (fast:out — kitchen.outConf, конфирмат через боковину в соседа, k15 m12)
const outside=(p:Part)=>/^(leg|kitchen-leg|kitchen-clip|kitchen-hanger|nail|fast:out:)/.test(p.id)||/:screw:f\d/.test(p.id)||/Опора|Ножка|Клипса|Навес|Заглушка навеса|Подпятник/i.test(p.name);

const sets=new Map<string,Module>();
const kinds:[ModuleKind,number,number,number][]=[['empty',800,2200,600],['shelves',800,2000,400],['wardrobe',1000,2200,600],['drawers',600,850,550],['corner',1050,2000,450],['desk',1200,750,600],['kupe',1600,2400,100]];
for(const [k,w,h,d] of kinds)sets.set('palette:'+k,createModule(k,w,h,d,initialModule()));
sets.set('Шкаф в прихожую',initialModule());
for(const f of ['examples/kupe-wardrobe.project.json',...readdirSync('examples/orders').map(f=>'examples/orders/'+f)]){const p=parseProject(JSON.parse(readFileSync(f,'utf8')));p.modules.forEach((a,i)=>sets.set(`${f}#${i}`,a.module));}
for(const kind of ['doors','drawers','sink','oven','dishwasher'] as const)sets.set('kitchen:'+kind,kitchenBase(initialModule(),600,kind));
sets.set('kitchen:wall',kitchenWall(initialModule(),600));sets.set('kitchen:tall',kitchenTall(initialModule(),600));
kitchenProject().modules.forEach((a,i)=>sets.set('kitchenProject#'+i,a.module));
// кухни из проектов Базиса цеха (локальная папка, если есть): модули студии по спецификации Базиса
const LP='public/local-projects';
if(existsSync(LP))for(const f of readdirSync(LP).filter(f=>/^kitchen-k\d+\.json$/.test(f))){try{const p=parseProject(JSON.parse(readFileSync(join(LP,f),'utf8')));p.modules.forEach((a,i)=>sets.set(`${f}#${i}`,a.module));}catch{/* битый файл — не предмет теста */}}

test('заглушка крепежа с сеткой Базиса лежит по оси крепежа — в габарите детали (не штырь над плитой)',()=>{
  let n=0;
  for(const [k,m] of sets)for(const p of parts(m)){
    if(p.role!=='fastener'||!p.model?.native)continue;n++;
    const g=fastenerGeometry(p.size);g.computeBoundingBox();const b=g.boundingBox!;
    for(let i=0;i<3;i++)assert.ok(Math.abs((b.max.getComponent(i)-b.min.getComponent(i))/2)<=p.size[i]/2+0.01,`${k} ${p.id} ${p.name}: заглушка ${i} ${(b.max.getComponent(i)-b.min.getComponent(i)).toFixed(1)} > ${p.size[i]}`);
  }
  assert.ok(n>100,'конфирматы и полкодержатели с сетками есть в наборе: '+n);
  // конфирмат крыши/дна через боковину (ось X, 50×7×7): раньше цилиндр стоял по Y — 50 мм в плите 16 мм
  const g=fastenerGeometry([50,7,7]);g.computeBoundingBox();assert.ok(g.boundingBox!.max.y<=3.51&&g.boundingBox!.max.x>=24.99);
});

test('крепёж студии (сетка Базиса / процедурная модель / габарит) не выходит за корпус больше 0,5 мм: шкафы, купе, кухни',()=>{
  const bad:string[]=[];let n=0;
  for(const [k,m] of sets){
    const ps=parts(m),boards=ps.filter(p=>(p.material==='board'||p.material==='hdf')&&p.role!=='door'&&!p.rotY&&!p.rotZ&&!/worktop|plinth/i.test(p.id));
    if(!boards.length)continue;
    const lo=[0,1,2].map(i=>Math.min(...boards.map(p=>p.position[i]-p.size[i]/2))),hi=[0,1,2].map(i=>Math.max(...boards.map(p=>p.position[i]+p.size[i]/2)));
    for(const p of ps){
      if(p.role!=='fastener'||p.id.startsWith('raw:')||outside(p))continue;n++;
      const v=visual(p,ps,m);
      for(let i=0;i<3;i++){const d=Math.max(lo[i]-v.lo[i],v.hi[i]-hi[i]);if(d>0.5)bad.push(`${k} ${p.id} «${p.name}» ось ${'xyz'[i]}: +${d.toFixed(1)} мм`);}
    }
  }
  assert.ok(n>300,'крепежа в наборе: '+n);
  assert.deepEqual(bad.slice(0,20),[],bad.length+' выходов за корпус');
});

// Сетка GLB — той же матрицей, что и сцена (nativePlacement из hardwareModels.ts; Scene.tsx ставит holder по ней), а не своей формулой теста.
const glbAt=(p:Part)=>{const g=glbBox(p.model!.file);if(!g)return null;const at=nativePlacement(p.model!,p.position),mx=new THREE.Matrix4().makeTranslation(...p.position).multiply(at.matrix);
  return new THREE.Box3().setFromPoints([0,1,2,3,4,5,6,7].map(k=>new THREE.Vector3(k&1?g.hi[0]:g.lo[0],k&2?g.hi[1]:g.lo[1],k&4?g.hi[2]:g.lo[2]).applyMatrix4(mx)));};

test('ориентация сетки конфирмата: стержень 50 мм от головки внутрь по оси ввинчивания (+x, −x, +y, −y, −z), не над плитой',()=>{
  const head:V3=[100,200,300];
  for(const [axis,dir] of [['+x',[1,0,0]],['-x',[-1,0,0]],['+y',[0,1,0]],['-y',[0,-1,0]],['-z',[0,0,-1]]] as const){
    const p={position:[head[0]+dir[0]*25,head[1]+dir[1]*25,head[2]+dir[2]*25],model:{file:'hardware/bazis/f660d89fba1a.glb',length:'y',native:true,origin:head,quat:CONFIRMAT_QUATS[axis]}} as unknown as Part;
    const b=glbAt(p)!;const i=dir.findIndex(v=>v!==0),s=dir[i];
    // по оси — от головки (0) до 50 в сторону ввинчивания; поперёк — радиус 5
    assert.ok(Math.abs((s>0?b.min:b.max).getComponent(i)-head[i])<0.01&&Math.abs((s>0?b.max:b.min).getComponent(i)-(head[i]+s*50))<0.01,`${axis}: ${b.min.toArray()}…${b.max.toArray()}`);
    for(const j of [0,1,2])if(j!==i)assert.ok(b.max.getComponent(j)-head[j]<=5.01&&head[j]-b.min.getComponent(j)<=5.01,`${axis} поперёк ${j}`);
  }
});

test('сетки крепежа Базиса (матрица сцены) внутри корпуса: шкафы, кухни и проекты local-projects, включая сырые из Базиса',()=>{
  const all=new Map(sets);
  if(existsSync(LP))for(const f of readdirSync(LP).filter(f=>f.endsWith('.json')&&!/^(kitchens|wardrobes)\.json$/.test(f)&&!/^kitchen-k\d+\.json$/.test(f))){try{parseProject(JSON.parse(readFileSync(join(LP,f),'utf8'))).modules.forEach((a,i)=>all.set(`${f.replace(/[a-z]{3,}(?=\.json)/,'x')}#${i}`,a.module));}catch{/* битый файл */}}
  const bad:string[]=[];let n=0;
  for(const [k,m] of all){
    const ps=parts(m),boards=ps.filter(p=>(p.material==='board'||p.material==='hdf')&&p.role!=='door'&&!p.rotY&&!p.rotZ&&!p.external&&!/worktop|plinth/i.test(p.id));
    if(!boards.length)continue;
    const lo=[0,1,2].map(i=>Math.min(...boards.map(p=>p.position[i]-p.size[i]/2))),hi=[0,1,2].map(i=>Math.max(...boards.map(p=>p.position[i]+p.size[i]/2)));
    for(const p of ps){
      // сырой модуль Базиса: корпусной крепёж (конфирмат, полкодержатель, эксцентрик, шкант); направляющие, фланцы, кронштейны — как в Базисе
      if(p.role!=='fastener'||!p.model?.native||outside(p)||(p.id.startsWith('raw:')&&!/Конфирмат|Евровинт|Полкодерж|Эксцентрик|Шкант|Стяжк/i.test(p.name)))continue;
      const b=glbAt(p);if(!b)continue;n++;
      for(let i=0;i<3;i++){const d=Math.max(lo[i]-b.min.getComponent(i),b.max.getComponent(i)-hi[i]);if(d>0.5)bad.push(`${k} ${p.id} «${p.name}» ${p.model.file.split('/').pop()} ось ${'xyz'[i]}: +${d.toFixed(1)} мм`);}
    }
  }
  assert.ok(n>1000,'сеток крепежа в наборе: '+n);
  assert.deepEqual(bad.slice(0,20),[],bad.length+' сеток за корпусом');
});

test('запасная модель петли (сетка не загрузилась) — в габарите сетки Базиса, не коробка',()=>{
  for(const f of ['hardware/bazis/39d9d9c26d8c.glb','hardware/bazis/d7e1d3957ebe.glb']){
    const g=hingeFallbackModel(f)!,b=box3(g),ref=glbBox(f)!;
    assert.ok(g.children.length>=2,f);
    for(let i=0;i<3;i++){assert.ok(b.min.getComponent(i)>=ref.lo[i]-0.01,`${f} min ${i}`);assert.ok(b.max.getComponent(i)<=ref.hi[i]+0.01,`${f} max ${i}`);}
  }
  assert.equal(hingeFallbackModel('hardware/bazis/ac675db9fc57.glb'),undefined,'не петля — без запасной модели');
});
