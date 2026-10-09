import test from 'node:test';
import assert from 'node:assert/strict';
import {xf,compose,panelBox,contourLoop,isRectLoop,ryRz,panelObb,planeContour,panelXf,qmat,mul,type Trans,type CPanel,type CElem} from '../scripts/wardrobe/xform';
import {isWardrobeImportFile} from '../scripts/wardrobe/files';
import {packRows,splitWide} from '../scripts/wardrobe/pack';
import {profileSection,snapToHolders} from '../scripts/wardrobe/profiles';
import {initialModule,section,id,parts,type Module} from '../src/model';
import {rawParts,parseRaw,rodCylinder,type RawSpec} from '../src/rawModule';
import {rawCheck,RAW_JOINT} from '../src/collisions';
import {collisionWarnings} from '../src/roomWarnings';
import {newProject} from '../src/project';

const rawM=(raw:RawSpec,w=1000,h=2000,d=600):Module=>({...initialModule(),name:'Шкаф из базы',width:w,height:h,depth:d,decor:'Белый',facadeDecor:'Белый',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw});

test('контур Базиса: элементы не по порядку и развёрнуты, дуга дискретизируется; неизвестный вид — габарит',()=>{
  // прямоугольник 0..500 × 0..800 со скруглённым углом R100 (дуга против часовой от (500,700) к (400,800)), элементы перемешаны
  const e:CElem[]=[{t:'line',p1:[0,0],p2:[500,0]},{t:'line',p1:[0,800],p2:[400,800]},{t:'line',p1:[500,0],p2:[500,700]},{t:'line',p1:[0,0],p2:[0,800]},{t:'arc',c:[400,700],p1:[500,700],p2:[400,800],dir:1}];
  const loop=contourLoop(e)!;
  assert.ok(loop&&loop.length>8,'дуга дала промежуточные точки');
  // все точки дуги — на радиусе 100 от центра, выпуклость наружу (x+y > 400+700)
  const arcPts=loop.filter(([x,y])=>x>400&&y>700);
  assert.ok(arcPts.length>=10);
  for(const [x,y] of arcPts){assert.ok(Math.abs(Math.hypot(x-400,y-700)-100)<1e-6);}
  assert.ok(!isRectLoop(loop,[0,0,500,800]));
  assert.ok(isRectLoop(contourLoop([{t:'line',p1:[0,0],p2:[500,0]},{t:'line',p1:[500,0],p2:[500,800]},{t:'line',p1:[500,800],p2:[0,800]},{t:'line',p1:[0,800],p2:[0,0]}])!,[0,0,500,800]));
  assert.equal(contourLoop([...e,{t:'kind17'}]),null);
  assert.equal(contourLoop([{t:'line',p1:[0,0],p2:[500,0]},{t:'line',p1:[500,0],p2:[500,800]}]),null,'незамкнутый контур — габарит');
});

test('фигурная вертикальная деталь: контур в плоскости yz/xy модуля и faceContour в студии',()=>{
  // стойка, повёрнутая в плоскость YZ (как боковина шкафа): локальные x,y Базиса → мировые z,y, толщина по X
  const s=Math.SQRT1_2,p:CPanel={name:'Боковина',mat:'ЛДСП 16',thick:16,bbox:[0,0,500,800],trans:{x:0,y:0,z:0,q:[s,0,-s,0]}};
  const box=panelBox(p,xf())!,w=panelXf(p,xf());
  const loop:[number,number][]=[[0,0],[500,0],[500,700],[400,800],[0,800]];
  const pc=planeContour(loop,w,box)!;
  assert.equal(pc.plane,'yz');
  for(const [y,z] of pc.pts){assert.ok(y>=box[1]-1e-6&&y<=box[4]+1e-6&&z>=box[2]-1e-6&&z<=box[5]+1e-6,`точка ${y},${z} в габарите`);}
  // в студии: сырой модуль с этим контуром рисуется faceContour (контур от угла габарита)
  const o=[box[0],box[1],box[2]],rb=box.map((v,i)=>v-o[i%3]) as [number,number,number,number,number,number];
  const m=rawM({panels:[{name:'Боковина',kind:'ldsp',box:rb,contour:pc.pts.map(([u,v])=>[u-o[1],v-o[2]]),plane:'yz'}],hardware:[]});
  const part=rawParts(m)[0];
  assert.ok(part.faceContour&&part.faceContour.length===5);
  assert.equal(part.planContour,undefined);
  // повторное чтение проекта контур сохраняет
  assert.equal(parseRaw(JSON.parse(JSON.stringify(m.raw)))!.panels[0].contour!.length,5);
});

test('повёрнутая не на 90° деталь: честный короб по повороту (rotY/rotZ студии), а не раздутый габарит',()=>{
  const deg=40*Math.PI/180,q:[number,number,number,number]=[Math.cos(deg/2),0,Math.sin(deg/2),0];
  const p:CPanel={name:'Вертикальная',mat:'ЛДСП 16',thick:16,bbox:[0,0,400,2000],trans:{x:0,y:0,z:0,q}};
  const o=panelObb(p,xf())!;
  assert.ok(o);
  assert.deepEqual(o.size.map(v=>Math.round(v)).sort((a,b)=>a-b),[16,400,2000]);
  // реконструкция: Ry·Rz с перестановкой осей даёт исходный поворот
  const R=panelXf(p,xf()).R,r=ryRz(R)!;
  const cy=Math.cos(r.ry*Math.PI/180),sy=Math.sin(r.ry*Math.PI/180),cz=Math.cos(r.rz*Math.PI/180),sz=Math.sin(r.rz*Math.PI/180);
  const E=[cy*cz,-cy*sz,sy,sz,cz,0,-sy*cz,sy*sz,cy];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(Math.abs(E[i*3+j])-Math.abs(R[i*3+r.perm[j]]))<1e-6);
  // «свободный» поворот из корпуса (фронтальная в 021: ось детали вертикальна) тоже выражается
  assert.ok(ryRz([0.106,0.994,0,0,0,-1,-0.994,0.106,0].map((v,i)=>i===0||i===8?v/Math.hypot(0.106,0.994):i===1||i===6?v/Math.hypot(0.106,0.994):v)));
  // поворот вокруг всех трёх осей сразу (ни одна ось детали не горизонтальна) — null, деталь рисуется габаритом с пометкой
  assert.equal(ryRz(mul(qmat([Math.cos(0.3),Math.sin(0.3),0,0]),qmat([Math.cos(0.4),0,0,Math.sin(0.4)]))),null);
  // в студии: размеры раскроя — истинные, поворот — в rotY
  const m=rawM({panels:[{name:'Вертикальная',kind:'ldsp',box:[0,0,0,320,2000,270],obb:{size:[400,2000,16],ry:40,rz:0}}],hardware:[]});
  const part=rawParts(m)[0];
  assert.deepEqual(part.size,[400,2000,16]);assert.equal(part.rotY,40);
  assert.equal(part.length,2000);assert.equal(part.width,400);assert.equal(part.thickness,16);
});

test('профили: рисуется только труба Ø25 (сечение однозначно по имени), ось — по держателям; остальное не придумываем',()=>{
  for(const n of ['Труба Д25','Труба 25мм','Труба D25 мм'])assert.deepEqual(profileSection(n),{d:25},n);
  for(const n of ['Профиль','Logo','Hettich Brand','Шлегель, 9х5','Профиль алюминиевый GOLA L-образный, 5.5м, серебро.Тип 3 , AKS','Направл. двухпол. верхняя','Верхний профиль " PREMIAL"'])assert.equal(profileSection(n),null,n);
  // фланцы на концах трубы смещены от начала координат профиля — ось ставится по ним
  assert.deepEqual(snapToHolders([600,1950,306],[1,0,0],1000,[[100,1915,279],[1100,1915,279]]),[600,1915,279]);
  assert.equal(snapToHolders([600,1950,306],[1,0,0],1000,[[600,1000,300]]),null,'держателя у концов нет — не рисуем');
  // в студии — штанга вдоль своей оси
  const m=rawM({panels:[],hardware:[],profiles:[{name:'Труба Д25',len:1000,d:25,pos:[500,1900,300],dir:[1,0,0]},{name:'Труба Д25',len:400,d:25,pos:[100,1500,300],dir:[0,0,1]}]});
  const rods=rawParts(m).filter(p=>p.role==='rod');
  assert.equal(rods.length,2);
  assert.deepEqual(rods[0].size,[1000,25,25]);assert.equal(rods[0].rotY,undefined);
  assert.equal(rods[1].rotY,90);
  // вертикальная труба (125/126/216: «Труба 25мм» 1849 мм вверх) — цилиндр Ø25 высотой 1849 по Y, не диск Ø1849 (критик 09.10.2026)
  const v=rawParts(rawM({panels:[],hardware:[],profiles:[{name:'Труба 25мм',len:1849,d:25,pos:[300,1000,280],dir:[0,1,0]}]})).find(p=>p.role==='rod')!;
  assert.deepEqual(v.size,[25,1849,25],'габарит в модуле — вертикальный');
  assert.equal(v.rotZ,undefined);
  assert.deepEqual(rodCylinder(v.size),{r:12.5,h:1849,vertical:true});
  // студийные штанга и фланец — как раньше: вдоль X, радиус по size[1]
  assert.deepEqual(rodCylinder([968,25,25]),{r:12.5,h:968,vertical:false});
  assert.deepEqual(rodCylinder([5,48,48]),{r:24,h:5,vertical:false});
  assert.deepEqual(rodCylinder(rods[0].size),{r:12.5,h:1000,vertical:false});
});

test('051: модель из 19 мелких сборок верхнего уровня на 33 м делится по сборкам и раскладывается в помещение',()=>{
  const groups=Array.from({length:19},(_,i)=>({x:i*1750,w:502}));
  const one=[{x:0,w:33428}];
  const mods=splitWide(one,groups,(g)=>g.w+0*g.x);
  assert.equal(mods.length,19);
  assert.ok(packRows(mods.map(()=>({w:502,h:2665,d:16,y:0}))));
  // обычный шкаф одним модулем не делится
  assert.equal(splitWide([{x:0,w:2400}],groups.slice(0,3),(g)=>g.w).length,1);
});

test('пересечения сырого модуля: политика без ложных тревог',()=>{
  const side:[number,number,number,number,number,number]=[0,0,0,16,2000,600];
  const raw:RawSpec={panels:[{name:'Бок',kind:'ldsp',box:side},{name:'Полка',kind:'ldsp',box:[16,1000,0,984,1016,600]},{name:'ХДФ в пазу',kind:'hdf',box:[8,0,4,992,2000,7]},{name:'Бок правый',kind:'ldsp',box:[984,0,0,1000,2000,600]}],
    hardware:[
      // направляющая: точка крепления на пласти боковины, габарит сетки заходит в стойку на 5 мм — не тревога
      {name:'Направляющая',category:'направляющая',mesh:'x',pos:[16,500,10],quat:[1,0,0,0],bbox:[-5,0,0,13,45,450]},
      // петля: чашка в фасаде, плечо — на боковине
      {name:'Петля',category:'петля',mesh:'x',pos:[16,1800,580],quat:[1,0,0,0],bbox:[-2,-25,-20,40,25,30]},
    ]};
  const m=rawM(raw),ps=parts(m);
  const r=rawCheck(ps,m);
  assert.equal(r.checked,2);assert.equal(r.outside.length,0);assert.equal(r.deep.length,0);
  assert.equal(r.overlaps.length,0,'паз ХДФ и стыки мельче '+RAW_JOINT+' мм — не перекрытие');
  // габарит сетки фурнитуры — по bbox Базиса, а не точка 10 мм
  const slide=ps.find(p=>p.name==='Направляющая')!;
  assert.deepEqual(slide.collide?.[0].size,[18,45,450]);
  const project=(mm:Module)=>{const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:0,y:0,z:0,rotation:0,module:mm}];return p;};
  assert.equal(collisionWarnings(project(m)).length,0);
  // фурнитура в воздухе — сведения (outside), не тревога; глубоко в детали — тревога
  const air=rawM({...raw,hardware:[{name:'Навес',category:'навес',mesh:'x',pos:[500,1500,300],quat:[1,0,0,0]}]});
  assert.equal(rawCheck(parts(air),air).outside.length,1);
  assert.equal(collisionWarnings(project(air)).length,0);
  const deep=rawM({...raw,panels:[...raw.panels,{name:'Тумба',kind:'ldsp',box:[100,0,0,900,200,600]}],hardware:[{name:'Опора',category:'опора',mesh:'x',pos:[500,100,300],quat:[1,0,0,0]}]});
  assert.equal(rawCheck(parts(deep),deep).deep.length,1);
  assert.equal(collisionWarnings(project(deep)).length,1);
  // перекрытие панелей глубже 10 мм — сведения «как в Базисе»
  const ov=rawM({...raw,panels:[...raw.panels,{name:'Вставка',kind:'ldsp',box:[0,500,0,100,516,600]}],hardware:[]});
  assert.ok(rawCheck(parts(ov),ov).overlaps.length>=1);
  assert.equal(collisionWarnings(project(ov)).length,0);
});

test('сцена Базиса шире 20 м раскладывается рядами в помещение до 20 000 мм, модули не пересекаются',()=>{
  // как 025: 7 изделий, в сцене 23 м по ширине; одно висит на y=3500 (выше 2600 — на пол)
  const items=[{w:2400,h:2500,d:616,y:0},{w:3800,h:416,d:420,y:0},{w:1200,h:600,d:450,y:200},{w:2502,h:180,d:420,y:281},{w:1830,h:2402,d:616,y:60},{w:9503,h:2500,d:585,y:3500},{w:2435,h:2500,d:638,y:0}];
  const r=packRows(items)!;
  assert.ok(r);
  assert.ok(r.room.width<=20000&&r.room.depth<=20000&&r.room.height<=20000,JSON.stringify(r.room));
  r.pos.forEach((p,i)=>{const it=items[i];assert.ok(p.x>=0&&p.z>=0&&p.x+it.w<=r.room.width&&p.z+it.d<=r.room.depth&&p.y+it.h<=r.room.height,`модуль ${i}`);});
  assert.equal(r.pos[2].y,200); assert.equal(r.pos[5].y,0);
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=r.pos[i],b=r.pos[j],A=items[i],B=items[j];
    const sep=a.x+A.w<=b.x||b.x+B.w<=a.x||a.z+A.d<=b.z||b.z+B.d<=a.z;
    assert.ok(sep,`модули ${i} и ${j} пересекаются`);
  }
  // один модуль шире лимита (как 051, 33 м) — не раскладываем
  assert.equal(packRows([{w:33428,h:2665,d:16,y:0}]),null);
});

test('parts-snapshot исключает только импорт wardrobe-NNN.json и wardrobes.json',()=>{
  for(const f of ['wardrobe-001.json','wardrobe-271.json','wardrobes.json']) assert.ok(isWardrobeImportFile(f),f);
  for(const f of ['wardrobe.json','wardrobe-ivanov.json','wardrobe-12-copy.json','wardrobe-001.json.bak','my-wardrobe-001.json']) assert.ok(!isWardrobeImportFile(f),f);
});

const T=(x:number,y:number,z:number,q:[number,number,number,number]=[1,0,0,0]):Trans=>({x,y,z,q});
const near=(a:number[],b:number[])=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`[${i}] ${v} != ${b[i]}`));
const s=Math.SQRT1_2;

test('wardrobe import: panel.chain учитывается (днище ящика встаёт на направляющую, а не на пол)',()=>{
  // сборка ящика на высоте 800, у днища chain = подъём на 15 (как wardrobe-012: днище y=815 на направляющей y=815)
  const p:CPanel={name:'Дно ящика',mat:'ЛДСП 16',thick:16,bbox:[0,0,400,500],trans:T(0,0,0,[s,-s,0,0]),chain:[T(0,15,0)]};
  const b=panelBox(p,xf(T(0,800,0)))!;
  assert.equal(Math.round(b[1]),815);
  const noChain=panelBox({...p,chain:undefined},xf(T(0,800,0)))!;
  assert.equal(Math.round(noChain[1]),800);
});

test('wardrobe import: порядок chain как в dump.py — сборка ∘ chain[0] ∘ … ∘ chain[n-1] ∘ trans',()=>{
  // chain[0] = поворот 90° вокруг Y, chain[1] = сдвиг x+100: точка (0,0,0) -> R·(100,0,0) = (0,0,-100)
  const p:CPanel={name:'деталь',mat:'ЛДСП',thick:0,bbox:[0,0,0,0],trans:T(0,0,0),chain:[T(0,0,0,[s,0,s,0]),T(100,0,0)]};
  near(panelBox(p,xf())!,[0,0,-100,0,0,-100]);
  // обратный порядок дал бы (100,0,0) — проверяем, что это не так
  const rev=panelBox({...p,chain:[...p.chain!].reverse()},xf())!;
  near(rev,[100,0,0,100,0,0]);
  // без chain совпадает с прежним расчётом сборка ∘ trans
  const w=compose(xf(T(10,20,30)),xf(T(1,2,3)));
  near(panelBox({...p,chain:[],trans:T(1,2,3)},xf(T(10,20,30)))!,[...w.t,...w.t]);
});
