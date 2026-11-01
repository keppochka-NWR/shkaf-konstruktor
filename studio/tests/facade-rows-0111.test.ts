// Макс 01.11: 1) ряды фасадов у обычного шкафа (3, 4, 5 рядов): высоты, петли по ряду, створки по рядам, ручки, снятые двери, детали, цена;
// 2) «Фасад ящика вровень с распашными фасадами»: лицо фасада ящика = лицо двери (накладные, вкладные, ALU, МДФ), зазоры как у двери, петли, короб.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {doorBands,doorRowCount,doorRowsBlock,drawersFlush,drawersFlushBlock,facadeBottom,facadeTop,initialModule,parseModule,parts,RULES,setDoorHandlePos,validate,type Module,type Part,type Section} from '../src/model';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {partCollisions} from '../src/collisions';
import {setDrawersOverlay,setDoorMount,fullSectionDrawer} from '../src/drawerModes';
import {doorPickLabel,doorRowHeights,MAX_DOOR_ROWS,maxDoorRows,setDoorRowCount,setDoorSplit} from '../src/doorRows';
import {doorQuickItems,drawerQuickItems,type QuickMenuOps} from '../src/quickMenu';
import {setDoorHinge,singleLeafDoors} from '../src/facadeEditing';
import {applyGroupFacade,groupFacadeValue} from '../src/groupFacades';
import {captureSectionFilling,pasteSectionFilling,removePart} from '../src/operations';
import {DEFAULT_ALU} from '../src/alu';
import {HANDLES} from '../src/handles';
import {drawerRowInfo,keepDrawersOnRows,neighbourRowSeams,setDrawersToRow} from '../src/drawerRowAlign';
import {DEFAULT_VERNISSAGE} from '../src/facadesVernissage';
import {setModuleHandleFloor} from '../src/handleFloorGroup';

const section=(over:Partial<Section>={}):Section=>({...initialModule().sections[0],id:'s1',shelves:[],drawers:0,rod:false,...over});
const wardrobe=(w=800,h=2400,d=600,over:Partial<Section>={}):Module=>{const m=initialModule();m.width=w;m.height=h;m.depth=d;m.doors=true;m.sections=[section(over)];return m;};
const doors=(m:Module)=>parts(m).filter(p=>p.role==='door'&&/:door:\d+$/.test(p.id));
const fronts=(m:Module,sid='s1')=>parts(m).filter(p=>p.sectionId===sid&&/:drawer:\d+:facade$/.test(p.id)).sort((a,b)=>a.position[1]-b.position[1]);
const lo=(p:Part)=>p.position[1]-p.size[1]/2,hi=(p:Part)=>p.position[1]+p.size[1]/2;
const faceZ=(p:Part)=>p.position[2]+p.size[2]/2;
const project=(m:Module):Project=>{const p=newProject(m);p.modules[0]={...p.modules[0],module:m};return p;};
const hingesOf=(m:Module,d:Part)=>parts(m).filter(p=>p.id.startsWith(d.id.replace(':door:',':hingecup:')+':'));
const realHits=(m:Module)=>partCollisions(parts(m),m).filter(c=>[c.a,c.b].some(p=>/:(door|handle|hinge|drawer)/.test(p))).map(c=>c.names.join(' x ')+' '+c.depth);

for(const rows of [3,4,5] as const){
 test(`${rows} ряда на шкафу: высоты сходятся, петли по ряду, детали и цена`,()=>{
  const m=wardrobe(600,2400);setDoorRowCount(m,'s1',rows);
  assert.deepEqual(validate(m),[],'модель верна');
  assert.equal(doorRowCount(m,m.sections[0]),rows);
  const ds=doors(m).sort((a,b)=>a.position[1]-b.position[1]);
  assert.equal(ds.length,rows,'по двери на ряд: 600 — одна створка');
  // низ и верх — как у целой двери, между рядами — обычный зазор фасадов, ряды равные с точностью до остатка верхнему
  assert.ok(Math.abs(lo(ds[0])-facadeBottom(m))<0.01);assert.ok(Math.abs(hi(ds.at(-1)!)-facadeTop(m))<0.01);
  for(let i=1;i<rows;i++)assert.ok(Math.abs(lo(ds[i])-hi(ds[i-1])-RULES.faceGap)<0.01,'зазор между рядами');
  const hs=ds.map(d=>d.size[1]);assert.ok(Math.max(...hs)-Math.min(...hs)<=2.5,'ряды поровну: '+hs);
  assert.ok(Math.abs(hs.reduce((a,x)=>a+x,0)+(rows-1)*RULES.faceGap-(facadeTop(m)-facadeBottom(m)))<0.01,'сумма высот');
  // петли — по высоте своего ряда и в пределах двери
  for(const d of ds){const cs=hingesOf(m,d);assert.ok(cs.length>=2,'петли на каждом ряду');assert.ok(cs.every(h=>h.position[1]>lo(d)&&h.position[1]<hi(d)));}
  assert.deepEqual(realHits(m),[],'нет пересечений');
  // раскрой и цена: двери по рядам в деталях, петли в смете — как фактические, цена выше цельной двери на петли
  const one=wardrobe(600,2400),p=project(m),e=estimate(p,nest(p)),e1=estimate(project(one),nest(project(one)));
  const hingeQty=(x:typeof e)=>x.lines.filter(l=>/^hinge/.test(l.id)).reduce((a,l)=>a+l.quantity,0);
  assert.equal(hingeQty(e),ds.reduce((a,d)=>a+hingesOf(m,d).length,0),'петель в смете столько, сколько поставлено');
  assert.ok(hingeQty(e)>hingeQty(e1));
  assert.ok(parts(m).filter(x=>x.role==='door').every(x=>x.length>=RULES.doorRowMinH));
  // файл сохраняет ряды
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).sections[0].doorRows,m.sections[0].doorRows);
 });
}

test('ручная высота ряда: верхний — остаток; мало места — понятная ошибка; снять деление — чистая дверь',()=>{
 const m=wardrobe(600,2400);setDoorRowCount(m,'s1',3);
 m.sections[0].doorRows=[500];assert.deepEqual(validate(m),[]);
 assert.equal(doors(m).sort((a,b)=>a.position[1]-b.position[1])[1].size[1],500);
 const up=doorRowHeights(m,m.sections[0]).at(-1)!;assert.ok(up>500);
 const tooLow=structuredClone(m);tooLow.sections[0].doorRows=[150];assert.ok(validate(tooLow).some(e=>/ряды фасадов/.test(e)),'средний ряд ниже 200');
 const high=structuredClone(m);high.sections[0].doorRows=[high.height-high.sections[0].doorSplit!-150];
 assert.ok(validate(high).length>0,'верхний ряд съели');assert.ok(validate(high).some(e=>/ряд/.test(e)));
 setDoorSplit(m,'s1',false);assert.deepEqual(validate(m),[]);assert.equal(m.sections[0].doorRows,undefined);assert.equal(doors(m).length,1);
 // с проёмом между рядами — снимается тоже (раньше проверка падала на doorNiche без doorSplit)
 const n=wardrobe(600,2400,600,{doorSplit:600,doorNiche:300});assert.deepEqual(validate(n),[]);setDoorSplit(n,'s1',false);assert.deepEqual(validate(n),[]);assert.equal(n.sections[0].doorNiche,undefined);
});

test('рядов больше, чем встаёт: отказ с причиной; низкий корпус; предел 5',()=>{
 const m=wardrobe(600,900);assert.equal(maxDoorRows(m,m.sections[0]),4);
 assert.throws(()=>setDoorRowCount(m,'s1',5),/не встанет.*200 мм/);
 setDoorRowCount(m,'s1',4);assert.deepEqual(validate(m),[]);
 assert.throws(()=>setDoorRowCount(m,'s1',MAX_DOOR_ROWS+1),/от 1 до 5/);
});

test('настройки по створкам в 3–5 рядах: две створки, петли, ручка, снятие, подпись кнопки',()=>{
 const m=wardrobe(1000,2400);setDoorRowCount(m,'s1',4);assert.deepEqual(validate(m),[]);
 assert.equal(doors(m).length,8,'4 ряда по 2 створки');
 assert.deepEqual(doors(m).map(d=>d.id.split(':door:')[1]).sort((a,b)=>+a-+b),['0','1','2','3','4','5','6','7']);
 assert.equal(doorPickLabel(m,m.sections[0],'s1:door:5'),'Дверь 6 · ряд 3');
 // ручка, расположение, высота и петли отдельной створки верхнего ряда — не упираются в старые пределы 4 и 8
 const s=m.sections[0];s.doorHandles=Array.from({length:8},(_,k)=>k===7?'fp527-160':null);
 setDoorHandlePos(m,'s1:door:6','topCorner');
 setDoorHinge(m,'s1:door:7','left');assert.equal(parts(m).find(p=>p.id==='s1:door:7')!.hinge,'left');
 s.hingeAngles=Array.from({length:8},(_,k)=>k===6?165:null);
 assert.deepEqual(validate(m),[]);
 const five=wardrobe(1000,2400);setDoorRowCount(five,'s1',5);five.sections[0].doorHandles=Array.from({length:10},(_,k)=>k===9?'fp527-160':null);five.sections[0].handlePos=Array.from({length:10},(_,k)=>k===9?'bottomCenter':null);assert.deepEqual(validate(five),[]);
 assert.equal(parts(five).find(p=>p.id==='s1:handle:9')!.name.includes('Ручка'),true);
 // снять дверь ряда — только её; ряд меньше — лишние настройки уходят, снятые двери заново
 const p=project(m),mid=p.modules[0].id,q=removePart(p,mid,'s1','s1:door:3');
 assert.deepEqual(q.modules[0].module.sections[0].removedDoors,[3]);assert.equal(doors(q.modules[0].module).length,7);
 const back=q.modules[0].module;setDoorRowCount(back,'s1',2);assert.deepEqual(validate(back),[]);assert.equal(back.sections[0].removedDoors,undefined);assert.ok((back.sections[0].doorHandles?.length??0)<=4);
 // ручка на каждом ряду и по центру своего ряда
 const w=wardrobe(600,2400);setDoorRowCount(w,'s1',3);const ps=parts(w);
 for(const d of doors(w)){const h=ps.find(x=>x.id===d.id.replace(':door:',':handle:'))!;assert.ok(h,'ручка ряда');assert.ok(h.position[1]>lo(d)&&h.position[1]<hi(d));}
});

test('группа фасадов: расположение ручек и сторона петель на шкафу в 3 ряда',()=>{
 const m=wardrobe(600,2400);setDoorRowCount(m,'s1',3);
 const p=project(m),ids=[p.modules[0].id];
 assert.equal(singleLeafDoors(m).length,3);
 const a=applyGroupFacade(p,ids,'handlePos','topCorner');assert.deepEqual(a.skipped,[]);assert.deepEqual(validate(a.project.modules[0].module),[]);
 const b=applyGroupFacade(a.project,ids,'hingeSide','right');assert.deepEqual(b.skipped,[]);
 assert.equal(groupFacadeValue(b.project,ids,'hingeSide').value,'right');
 assert.ok(doors(b.project.modules[0].module).every(d=>d.hinge==='right'));
});

test('ряды: секции модуля независимы; ящики за дверью с рядами; ящики вровень под рядами; проём между рядами; выкатной на всю секцию',()=>{
 const m=wardrobe(1200,2400);m.sections=[section(),section({id:'s2'})];setDoorRowCount(m,'s1',3);
 assert.deepEqual(validate(m),[]);assert.equal(doors(m).filter(d=>d.sectionId==='s1').length,3);assert.equal(doors(m).filter(d=>d.sectionId==='s2').length,1);
 // за дверью: фальши по петлям всех рядов
 const b=wardrobe(600,2400,600,{drawers:2});setDoorRowCount(b,'s1',3);assert.deepEqual(validate(b),[]);assert.ok(parts(b).some(p=>p.id.includes(':filler:')));
 // вровень с рядами: первый ряд — над ящиками, сумма рядов до верха фасадов
 const v=wardrobe(600,2400,600,{drawers:2});setDrawersOverlay(v,'s1',true);setDoorRowCount(v,'s1',3);assert.deepEqual(validate(v),[]);
 const ds=doors(v).sort((a,b)=>a.position[1]-b.position[1]),fs=fronts(v);
 assert.equal(ds.length,3);assert.ok(Math.abs(lo(ds[0])-hi(fs.at(-1)!)-RULES.faceGap)<0.01);assert.ok(Math.abs(hi(ds[2])-facadeTop(v))<0.01);assert.ok(fs.every(f=>Math.abs(faceZ(f)-faceZ(ds[0]))<0.01));
 // сначала ряды, потом вровень: ряды пропорционально сжимаются, верхний не съеден
 const o=wardrobe(600,2400,600,{drawers:2});setDoorRowCount(o,'s1',3);const was=doorRowHeights(o,o.sections[0]);setDrawersOverlay(o,'s1',true);assert.deepEqual(validate(o),[]);
 const now=doorRowHeights(o,o.sections[0]);assert.equal(now.length,3);assert.ok(now.every((h,i)=>h<was[i]));assert.ok(Math.abs(now[0]/now[2]-was[0]/was[2])<0.02);
 setDrawersOverlay(o,'s1',false);assert.deepEqual(validate(o),[]);assert.ok(doorRowHeights(o,o.sections[0]).every((h,i)=>Math.abs(h-was[i])<2),'обратно — как было');
 // открытый проём между рядами при 3 рядах
 const n=wardrobe(600,2400,600,{doorSplit:700,doorNiche:300,doorRows:[500]});assert.deepEqual(validate(n),[]);
 const nb=doorBands(n,n.sections[0]);assert.equal(nb.length,3);assert.ok(Math.abs(nb[1][0]-nb[0][1]-300)<0.01,'проём — над нижним рядом');
 // выкатной на всю секцию снимает ряды
 const a=wardrobe(800,700);setDoorRowCount(a,'s1',1);a.sections[0].doorSplit=340;a.sections[0].doorRows=undefined;fullSectionDrawer(a,'s1');assert.equal(a.sections[0].doorRows,undefined);assert.deepEqual(validate(a),[]);
});

test('меню правой кнопки: «Рядов фасадов» у разделённой секции; снять деление',()=>{
 let m=wardrobe(600,2400);const ops:QuickMenuOps={modify:u=>{const n=structuredClone(m);u(n);m=n;},addUpper:()=>{}};
 assert.deepEqual(doorQuickItems(m,'s1',ops).map(i=>i.id),['q-door-split','q-door-mount']);
 doorQuickItems(m,'s1',ops)[0].run!();assert.equal(doors(m).length,2);
 const rows=doorQuickItems(m,'s1',ops).find(i=>i.id==='q-door-rows')!;assert.deepEqual(rows.children!.map(c=>c.label),['2','3','4','5']);
 rows.children!.find(c=>c.label==='4')!.run!();assert.equal(doors(m).length,4);assert.deepEqual(validate(m),[]);
 doorQuickItems(m,'s1',ops)[0].run!();assert.equal(doors(m).length,1);assert.deepEqual(validate(m),[]);
});

test('ряды недоступны с причиной: угловой шкаф, купе; кухня — как была (ряды до 400 по умолчанию)',()=>{
 assert.match(doorRowsBlock({...initialModule(),corner:{} as never})!,/Угловой/);
 assert.match(doorRowsBlock({...initialModule(),kupe:{} as never})!,/купе/);
 const c={...wardrobe(),corner:{} as never};assert.throws(()=>setDoorSplit(c,'s1',true),/Угловой/);assert.throws(()=>setDoorRowCount(c,'s1',3),/Угловой/);
 const t={...initialModule(),height:2470,width:680,depth:600,kitchen:{role:'tall' as const}};t.sections=[{...t.sections[0],doorLeaves:1 as const,doorSplit:826}];
 setDoorRowCount(t,t.sections[0].id,3);assert.deepEqual(t.sections[0].doorRows,[400]);assert.equal(t.sections[0].doorSplit,826,'кухня: нижний ряд не менялся');
});

test('вровень: ящики подняты от дна — дверь снизу, над ящиками своя, всё в одной плоскости; снять — одна дверь',()=>{
 const m=wardrobe(600,2200,600,{drawers:2,drawerConfigs:[{slide:'ball',height:140,length:500,y:500},{slide:'ball',height:140,length:500,y:680}]});
 setDrawersOverlay(m,'s1',true);assert.deepEqual(validate(m),[]);assert.ok(drawersFlush(m,m.sections[0]));
 const ds=doors(m).sort((a,b)=>a.position[1]-b.position[1]),fs=fronts(m);
 assert.equal(ds.length,2,'снизу и сверху');assert.ok(fs.every(f=>faceZ(f)===faceZ(ds[0])));assert.ok(hi(ds[0])<lo(fs[0])&&hi(fs[1])<lo(ds[1]));
 assert.ok(lo(fs[0])-hi(ds[0])<=4&&lo(ds[1])-hi(fs[1])<=4,'зазоры как между фасадами: '+[lo(fs[0])-hi(ds[0]),lo(ds[1])-hi(fs[1])]);
 setDrawersOverlay(m,'s1',false);assert.deepEqual(validate(m),[]);assert.equal(doors(m).length,1);assert.ok(fronts(m).every(f=>faceZ(f)<m.depth),'снова за дверью');
});

test('цена фасадов МДФ Вернисаж по рядам: площадь рядов (строка м²), присадка под петли каждого ряда; раскрой ЛДСП — без них',()=>{
 const mk=(rows:number)=>{const m=wardrobe(600,2400);m.vernissage={...DEFAULT_VERNISSAGE};m.facadeT=DEFAULT_VERNISSAGE.thickness;if(rows>1)setDoorRowCount(m,'s1',rows);return m;};
 const line=(m:Module)=>{const p=project(m),e=estimate(p,nest(p));return {e,v:e.lines.filter(l=>l.id.startsWith('vernissage:')),b:e.lines.find(l=>l.id==='vernissage-hinge-boring')!};};
 const one=mk(1),three=mk(3);assert.deepEqual(validate(three),[]);
 const a=line(one),c=line(three),area=(m:Module)=>doors(m).reduce((s,d)=>s+d.size[0]*d.size[1]/1e6,0);
 assert.ok(doors(three).every(d=>d.vernissage),'каждый ряд — МДФ');
 assert.ok(Math.abs(c.v.reduce((s,l)=>s+l.quantity,0)-area(three))<0.02,'м² в смете = сумма рядов: '+c.v.map(l=>l.quantity));
 assert.ok(area(three)<area(one),'зазоры между рядами');assert.ok(c.b.quantity>a.b.quantity,'присадка под петли каждого ряда');
 assert.equal(c.b.quantity,doors(three).reduce((s,d)=>s+hingesOf(three,d).length,0));
});

test('детали: двери рядов — в ведомости по одной; высота ручек от пола на все двери; копия наполнения несёт «вровень»',()=>{
 const m=wardrobe(600,2400);setDoorRowCount(m,'s1',5);assert.deepEqual(validate(m),[]);
 const names=parts(m).filter(p=>p.role==='door').map(p=>`${Math.round(p.length)}x${Math.round(p.width)}`);assert.equal(names.length,5);
 setModuleHandleFloor(m,1000);assert.deepEqual(validate(m),[],'поле на 5 рядов (10 створок) проходит проверку');
 const dep=wardrobe(600,2200,600,{drawers:2});setDrawersOverlay(dep,'s1',true);
 const p=project(dep),mid=p.modules[0].id,copy=captureSectionFilling(p,mid,'s1');assert.equal(copy.externalDrawers,true);
 const t=project(wardrobe(600,2200));const out=pasteSectionFilling(t,t.modules[0].id,'s1',copy).modules[0].module;assert.ok(drawersFlush(out,out.sections[0]));
});

test('проём с ящиками (заказ 7442203) и ряды: нижний ряд стоит, поровну делятся ряды над проёмом; снять деление не теряет дверь',()=>{
 const m=wardrobe(600,2400,600,{doorSplit:619,doorNiche:624,drawers:2,drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'dtc',height:140,length:270,y:589,facadeH:198},{slide:'gtv0fpo',operation:'soft-close',brand:'dtc',height:140,length:270,y:791,facadeH:198}]});
 assert.deepEqual(validate(m),[]);setDoorRowCount(m,'s1',3);assert.equal(m.sections[0].doorSplit,619);assert.deepEqual(validate(m),[]);assert.equal(doors(m).length,3);
 assert.ok(drawersFlush(m,m.sections[0]),'ящики между рядами — вровень');
 const hinge=wardrobe(600,2400,600,{doorSplit:1000,doorHinges:['right',null,'left',null]});setDoorSplit(hinge,'s1',false);assert.deepEqual(validate(hinge),[]);assert.equal(doors(hinge)[0].hinge,'right','петли двери, что осталась, — те же');
});

// ── ответы Макса 01.11: ряд шкафа от 200 мм; верх ящиков по ряду соседа ──
const sideBySide=(rowsAt:number[],drawers=2,over:Partial<Section>={})=>{const m=wardrobe(1200,2400);const a=section({id:'s1',drawers,...over}),b=section({id:'s2',doorSplit:rowsAt[0],...(rowsAt.length>1?{doorRows:rowsAt.slice(1)}:{})});m.sections=[a,b];return m;};
const capGap=(m:Module)=>{const up=doors(m).filter(d=>d.sectionId==='s1').sort((x,y)=>lo(x)-lo(y))[0],near=doors(m).filter(d=>d.sectionId==='s2').sort((x,y)=>Math.abs(lo(x)-lo(up))-Math.abs(lo(y)-lo(up)))[0];return {up,near};};

test('ряд 200 мм: петли 2 и без пересечений даже у широкой створки; ручка; цельная дверь по-прежнему от 360',()=>{
 const m=wardrobe(590,2400,600,{doorSplit:201});assert.deepEqual(validate(m),[]);
 const low=doors(m).sort((a,b)=>a.position[1]-b.position[1])[0];assert.equal(low.size[1],200);
 const cups=hingesOf(m,low).sort((a,b)=>a.position[1]-b.position[1]);assert.equal(cups.length,2,'при ширине >450 третья петля на 200 мм не встаёт');
 assert.ok(cups.every(h=>h.position[1]>lo(low)+17&&h.position[1]<hi(low)-17),'чашки в пределах фасада');assert.ok(cups[1].position[1]-cups[0].position[1]>=58,'планки 53 мм не упираются');assert.deepEqual(realHits(m),[]);
 const h=parts(m).find(p=>p.id==='s1:handle:0')!;assert.ok(h.position[1]>lo(low)&&h.position[1]<hi(low),'ручка на своём ряду');
 // ряды по 200+: соседние ряды не сталкивают петли
 const five=wardrobe(590,1200);setDoorRowCount(five,'s1',5);assert.deepEqual(validate(five),[]);assert.deepEqual(realHits(five),[]);assert.ok(doors(five).every(d=>hingesOf(five,d).length===2&&d.size[1]>=200));
 // с ручной высотой петель низкий ряд — тоже по правилу
 const hy=wardrobe(590,2400,600,{doorSplit:201,hingeY:[100,800,1600]});assert.equal(hingesOf(hy,doors(hy).sort((a,b)=>a.position[1]-b.position[1])[0]).length,2);
 // ниже 200 — отказ; длинная ручка на низком ряду — причина; цельная низкая дверь — старое правило 360
 const under=wardrobe(590,2400,600,{doorSplit:150});assert.ok(validate(under).length>0);
 const lowH=wardrobe(590,2400,600,{doorSplit:201});const longest=[...HANDLES].sort((a,b)=>b.len-a.len)[0];assert.ok(longest.len>200);lowH.handleId=longest.id;assert.ok(validate(lowH).some(e=>/Ручка \d+ мм длиннее фасада/.test(e)),validate(lowH).join('|'));
 const whole=wardrobe(590,330);assert.ok(validate(whole).some(e=>/Распашной фасад ниже 360/.test(e)),'цельная дверь — от 360');
});

test('смена высоты: верхний ряд ниже 200 — отказ с причиной про ряд; список рядов считает от 200',()=>{
 const m=wardrobe(590,2400);setDoorRowCount(m,'s1',3);const small=structuredClone(m);small.height=1200;
 const e=validate(small);assert.ok(e.some(x=>/верхний ряд фасадов/.test(x)&&/200 мм/.test(x)&&!/ряды фасадов:/.test(x)),e.join('|'));
 const two=wardrobe(590,2400,600,{doorSplit:1000});two.height=1100;assert.ok(validate(two).some(x=>/нижний ряд фасадов 1000 мм не оставляет места/.test(x)),validate(two).join('|'));
});

test('верх ящиков на стыке рядов соседа: дверь над ящиками = низ следующего ряда, зазоры как у дверей; ящики поровну; один вызов — одна правка',()=>{
 const m=sideBySide([500,600]);assert.deepEqual(validate(m),[]);
 setDrawersOverlay(m,'s1',true);assert.deepEqual(validate(m),[]);assert.equal(m.sections[0].drawersToRow,true);
 const {up,near}=capGap(m),fs=fronts(m);
 assert.ok(Math.abs(lo(up)-lo(near))<0.35,'низ двери над ящиками = низ ряда соседа: '+lo(up)+' / '+lo(near));
 assert.ok(Math.abs(lo(up)-hi(fs.at(-1)!)-RULES.faceGap)<0.35,'зазор как у дверей');
 assert.ok(Math.abs(Math.max(...fs.map(f=>f.size[1]))-Math.min(...fs.map(f=>f.size[1])))<=1,'фасады поровну');
 assert.ok(fs.every(f=>Math.abs(faceZ(f)-faceZ(up))<0.001),'и в плоскости');
 assert.deepEqual(drawerRowInfo(m,m.sections[0]),{seam:neighbourRowSeams(m,m.sections[0]).find(a=>Math.abs(a-(lo(up)-RULES.faceGap))<0.5)});
 assert.deepEqual(realHits(m),[]);
});

test('сосед меняет ряды — ящики идут за стыком в той же правке; соседа разделили заново; снято — стоят; вручную — привязка снята',()=>{
 const m=sideBySide([500,600]);setDrawersOverlay(m,'s1',true);const p=project(m);
 const edit=(q:Project,fn:(n:Module)=>void)=>{const n=structuredClone(q);fn(n.modules[0].module);return keepDrawersOnRows(q,n);};
 const a=edit(p,n=>{n.sections[1].doorSplit=620;});const ma=a.modules[0].module;assert.deepEqual(validate(ma),[]);
 const c=capGap(ma);assert.ok(Math.abs(lo(c.up)-lo(c.near))<0.35,'пошли за соседом');
 // соседа сделали цельным: стыков нет — ящики как есть, заметка
 const b=edit(a,n=>{setDoorSplit(n,'s2',false);});const mb=b.modules[0].module;assert.deepEqual(validate(mb),[]);
 assert.deepEqual(mb.sections[0].drawerConfigs,ma.sections[0].drawerConfigs,'как есть');assert.match((drawerRowInfo(mb,mb.sections[0]) as {none:string}).none,/не разделены/);
 // вручную задали высоту ящика — привязка снята, правка не откатилась
 const d=edit(a,n=>{const s=n.sections[0];s.drawerConfigs=s.drawerConfigs!.map((x,j)=>j===0?{...x,height:x.height-40}:x);});
 assert.equal(d.modules[0].module.sections[0].drawersToRow,undefined);assert.equal(d.modules[0].module.sections[0].drawerConfigs![0].height,ma.sections[0].drawerConfigs![0].height-40);
 // галочку сняли — ящики не идут за соседом
 const e=edit(a,n=>{setDrawersToRow(n,'s1',false);});const f=edit(e,n=>{n.sections[1].doorSplit=500;});assert.deepEqual(f.modules[0].module.sections[0].drawerConfigs,ma.sections[0].drawerConfigs);
 // поставили снова — встают
 const g=edit(f,n=>{setDrawersToRow(n,'s1',true);});const cg=capGap(g.modules[0].module);assert.ok(Math.abs(lo(cg.up)-lo(cg.near))<0.35);
});

test('стыка не найти: нет разумного — ящики как есть и заметка; проверка не ломается; фасад выше короба при большом стыке',()=>{
 // ящиков много, стык низко и высоко недостижимо: 5 ящиков на 201 мм не встанут, следующий стык слишком высоко для своей двери нет — как есть или ближайший подходящий
 const m=sideBySide([201],5);const before=parts(m).length;setDrawersOverlay(m,'s1',true);assert.deepEqual(validate(m),[]);void before;
 const info=drawerRowInfo(m,m.sections[0])!;assert.ok('none' in info||'seam' in info);
 if('none' in info)assert.match(info.none,/оставлены как есть/);
 // большой стык: короб 300, фасад выше короба, верх всё равно на стыке
 const big=sideBySide([900]);setDrawersOverlay(big,'s1',true);assert.deepEqual(validate(big),[]);
 const c=capGap(big);assert.ok(Math.abs(lo(c.up)-lo(c.near))<0.35,'большой стык: '+lo(c.up)+' / '+lo(c.near));assert.ok(fronts(big).every(f=>f.size[1]<=800));
 assert.ok(parts(big).filter(p=>/:drawer:\d+:left$/.test(p.id)).every(p=>p.size[1]<=300),'короб не выше 300');assert.deepEqual(realHits(big),[]);
 // сосед без рядов — ящики не меняются
 const flat=wardrobe(1200,2400);flat.sections=[section({drawers:2}),section({id:'s2'})];const ref=structuredClone(flat);setDrawersOverlay(ref,'s1',true);delete ref.sections[0].drawersToRow;setDrawersOverlay(flat,'s1',true);assert.deepEqual(flat.sections[0].drawerConfigs,ref.sections[0].drawerConfigs);
});

test('вкладные двери: дверь над ящиками на низу ряда соседа; старый проект с ящиками снаружи не двигается, пока не коснулись галочки',()=>{
 const i=sideBySide([500,600]);i.doorMount='inset';setDrawersOverlay(i,'s1',true);assert.deepEqual(validate(i),[]);const c=capGap(i);assert.ok(Math.abs(lo(c.up)-lo(c.near))<0.35,'inset '+lo(c.up)+' / '+lo(c.near));
 const old=sideBySide([500,600],2,{externalDrawers:true});const was=JSON.stringify(old),p=project(old);const out=keepDrawersOnRows(p,structuredClone(p));
 assert.equal(JSON.stringify(out.modules[0].module),was,'флага нет — без изменений');
 assert.equal(JSON.stringify(parseModule(JSON.parse(was))),JSON.stringify(parseModule(JSON.parse(JSON.stringify(out.modules[0].module)))));
 const fl=sideBySide([500,600]);setDrawersOverlay(fl,'s1',true);assert.equal(parseModule(JSON.parse(JSON.stringify(fl))).sections[0].drawersToRow,true,'файл хранит привязку');
});

// ── вровень ──
const flushCase=(name:string,tune:(m:Module)=>void)=>test('вровень: '+name,()=>{
 const m=wardrobe(600,2200,600,{drawers:3});tune(m);
 setDrawersOverlay(m,'s1',true);
 assert.deepEqual(validate(m),[],name);
 assert.ok(drawersFlush(m,m.sections[0]),'галочка стоит');
 const d=doors(m)[0],fs=fronts(m);
 assert.ok(d&&fs.length===3);
 for(const f of fs)assert.ok(Math.abs(faceZ(f)-faceZ(d))<0.001,`${name}: лицо ящика ${faceZ(f)} = лицо двери ${faceZ(d)}`);
 assert.ok(hingesOf(m,d).every(h=>h.position[1]>lo(d)&&h.position[1]<hi(d)),'петли в пределах двери');
 assert.ok(!parts(m).some(p=>p.id.includes(':filler:')),'фальшей нет');
 assert.deepEqual(realHits(m),[],name+': нет пересечений');
 // зазор между соседними фасадами — как между дверями; снять — дверь снова целая
 for(let i=1;i<fs.length;i++)assert.ok(lo(fs[i])-hi(fs[i-1])<=4);
 const full=d.size[1];setDrawersOverlay(m,'s1',false);assert.deepEqual(validate(m),[],name+' за дверью');assert.ok(doors(m)[0].size[1]>full,'снято — дверь выше');assert.ok(!drawersFlush(m,m.sections[0]));
});
flushCase('накладные ЛДСП',()=>{});
flushCase('накладные, фасад 19 (МДФ)',m=>{m.facadeT=19;});
flushCase('вкладные двери',m=>{m.doorMount='inset';});
flushCase('вкладные, фасад 22',m=>{m.doorMount='inset';m.facadeT=22;});
flushCase('накладные на ножках',m=>{m.feet={height:100} as never;});

test('вровень: вкладные — зазоры как у двери (2 мм к стойке и ко дну), лицо по лицу корпуса',()=>{
 const m=wardrobe(600,2200,600,{drawers:2});m.doorMount='inset';setDrawersOverlay(m,'s1',true);
 const d=doors(m)[0],f=fronts(m)[0];
 assert.equal(f.size[0],d.size[0],'ширина фасада = ширина вкладной двери');assert.equal(faceZ(f),m.depth);
 assert.equal(m.sections[0].drawerMount,'inset');
 // смена монтажа держит плоскость
 setDoorMount(m,'overlay');assert.equal(m.sections[0].drawerMount,undefined);assert.ok(drawersFlush(m,m.sections[0]));assert.equal(faceZ(fronts(m)[0]),faceZ(doors(m)[0]));
 setDoorMount(m,'inset');assert.ok(drawersFlush(m,m.sections[0]));assert.equal(faceZ(fronts(m)[0]),faceZ(doors(m)[0]));
});

test('вровень: двери в рамке ALU — фасады ящиков в той же рамке, лицо совпадает',()=>{
 const base=wardrobe(600,2200,600,{drawers:2});base.alu={...DEFAULT_ALU};
 const before=structuredClone(base);before.sections[0].externalDrawers=true;
 const dif=Math.abs(faceZ(fronts(before)[0])-faceZ(doors(before)[0]));assert.ok(dif>1,'без рамки на ящиках плоскости разные — поэтому галочка её ставит');
 assert.ok(!drawersFlush(before,before.sections[0]),'такой старый проект: галочка снята, лицо глубже');
 setDrawersOverlay(base,'s1',true);assert.equal(base.aluDrawers,true);
 assert.ok(drawersFlush(base,base.sections[0]));assert.ok(Math.abs(faceZ(fronts(base)[0])-faceZ(doors(base)[0]))<0.001);
});

test('вровень у соседней секции с дверью: лицо, низ и зазор к соседу как у дверей',()=>{
 const m=wardrobe(1200,2200);m.sections=[section({drawers:3}),section({id:'s2'})];m.sections[0].id='s1';
 setDrawersOverlay(m,'s1',true);assert.deepEqual(validate(m),[]);
 const f=fronts(m,'s1'),d=doors(m).find(x=>x.sectionId==='s2')!,up=doors(m).find(x=>x.sectionId==='s1')!;
 assert.ok(f.every(x=>Math.abs(faceZ(x)-faceZ(d))<0.001),'плоскость соседней двери');
 assert.ok(Math.abs(lo(f[0])-lo(d))<0.001,'низ нижнего фасада = низ соседней двери');
 assert.ok(Math.abs(f[0].size[0]-up.size[0])<0.001,'ширина фасада = ширина двери над ним');
 const gapX=(d.position[0]-d.size[0]/2)-(f[0].position[0]+f[0].size[0]/2);assert.ok(Math.abs(gapX-RULES.faceGap)<0.001,'зазор к двери соседа '+gapX);
 assert.deepEqual(realHits(m),[]);
});

test('вровень: длина направляющих подбирается, короб не упирается во вкладной фасад; за дверью — снова короче',()=>{
 const m=wardrobe(600,2200,400,{drawers:2});setDrawersOverlay(m,'s1',true);assert.deepEqual(validate(m),[]);
 const back=structuredClone(m);setDrawersOverlay(back,'s1',false);assert.deepEqual(validate(back),[],'за дверью длина ящика другая');
});

test('вровень нельзя — причина: скос, корзина; снять можно всегда; меню правой кнопки — одно название',()=>{
 const sk=wardrobe(600,2200,600,{drawers:2});sk.skew={side:'left',depth:400};assert.match(drawersFlushBlock(sk,sk.sections[0])!,/скос/i);assert.throws(()=>setDrawersOverlay(sk,'s1',true),/скос/i);
 const mesh=wardrobe(600,2200,600,{drawers:1,drawerConfigs:[{slide:'ball',height:140,length:500,noFacade:true}]});assert.match(drawersFlushBlock(mesh,mesh.sections[0])!,/нет фасада/);
 let m=wardrobe(600,2200,600,{drawers:2});const ops:QuickMenuOps={modify:u=>{const n=structuredClone(m);u(n);m=n;},addUpper:()=>{}};
 const it=drawerQuickItems(m,'s1',ops).find(i=>i.id==='drawer-mount')!;assert.equal(it.label,'Вровень с дверью');it.run!();assert.ok(drawersFlush(m,m.sections[0]));
 assert.equal(drawerQuickItems(m,'s1',ops).find(i=>i.id==='drawer-mount')!.label,'За дверью');
});

test('старые проекты: посадка, геометрия и номера створок шкафа в 2 ряда не меняются',()=>{
 const m=wardrobe(600,2200,600,{doorSplit:900});assert.equal(doorRowCount(m,m.sections[0]),2);
 const ds=doors(m).sort((a,b)=>a.position[1]-b.position[1]);assert.deepEqual(ds.map(d=>d.id),['s1:door:0','s1:door:2']);
 assert.equal(ds[0].size[1],900-RULES.faceGap/2+(0));assert.ok(Math.abs(hi(ds[1])-facadeTop(m))<0.01);
 const was=wardrobe(600,2200,600,{drawers:2,externalDrawers:true,drawerMount:'inset'});assert.ok(!drawersFlush(was,was.sections[0]),'накладные двери и вкладные фасады — не вровень, остаются как были');
 assert.equal(fronts(was)[0].size[0],600-2*16-2*RULES.drawerFrontGap,'вкладной фасад у накладной двери — прежняя ширина');
});
