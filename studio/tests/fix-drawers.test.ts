// fix-drawers (правки Макса 29.10.2026): 1) ящики секции со старта равные — комод, шаблоны, пересчёт при смене высоты и числа
// ящиков, ручные высоты не трогаются; 2) один выкатной ящик на всю секцию антресоли; 3) «ящики в накладку»: фасады в плоскости
// дверей, дверь над ящиками через обычный зазор, петли по новой высоте, переключатель туда-обратно.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,parts,validate,boxes,facadeTop,facadeBottom,fitDrawersAfterResize,drawersFillRoof,hasDrawerCap,isAutoDrawerLayout,evenDrawerConfigs,drawerFacesEqual,drawerStackHeight,parseModule,RULES,type Module,type Part} from '../src/model';
import {assembleModule,createModule} from '../src/paletteBuild';
import {applySectionTemplate,drawerQuickItems,type QuickMenuOps} from '../src/quickMenu';
import {setDrawerCount,setDrawersOverlay,fullSectionDrawer,roofDrawers} from '../src/drawerModes';
import {insertItem,removePart,addUpperModule} from '../src/operations';
import {drawerFitsOnTop} from '../src/drawerLimit';
import {newProject,projectErrors} from '../src/project';
import {estimate} from '../src/pricing';
import {SLIDES} from '../src/hardware';

const faces=(m:Module,sid=m.sections[0].id)=>parts(m).filter(p=>p.sectionId===sid&&/:drawer:\d+:facade$/.test(p.id)).sort((a,b)=>a.position[1]-b.position[1]);
const lo=(p:Part)=>p.position[1]-p.size[1]/2,hi=(p:Part)=>p.position[1]+p.size[1]/2;
const spread=(ps:Part[])=>Math.max(...ps.map(p=>p.size[1]))-Math.min(...ps.map(p=>p.size[1]));
function assertEven(m:Module,label:string,sid=m.sections[0].id){
  const fs=faces(m,sid);assert.ok(fs.length>1,label+': есть ящики');
  assert.ok(spread(fs)<=1,`${label}: фасады ${fs.map(p=>p.size[1]).join(' / ')} — не равные`);
  for(let j=1;j<fs.length;j++)assert.ok(Math.abs(lo(fs[j])-hi(fs[j-1])-RULES.faceGap)<0.01,`${label}: зазор между фасадами ${j} и ${j+1}`);
}

test('правка 1: комод из палитры — фасады равные со старта (было 310/244/260), низ 30 от пола, верх — до верха фасадов',()=>{
  for(const [w,h,d] of [[600,850,550],[800,700,450],[1000,1000,500],[800,400,450]] as const){
    const m=createModule('drawers',w,h,d,initialModule()),fs=faces(m);
    assert.deepEqual(validate(m),[]);assertEven(m,`комод ${w}×${h}`);
    assert.ok(Math.abs(lo(fs[0])-facadeBottom(m))<0.01);assert.ok(Math.abs(hi(fs.at(-1)!)-facadeTop(m))<0.01);
    assert.ok(drawersFillRoof(m,m.sections[0])&&!hasDrawerCap(m,m.sections[0]),'ящики до крыши без полки — как было');
    for(const p of parts(m).filter(p=>/:drawer:\d+:left$/.test(p.id)))assert.ok(p.size[1]>=68&&p.size[1]<=300,'боковина короба 68…300');
  }
  const d850=faces(createModule('drawers',600,850,550,initialModule())).map(p=>p.size[1]);
  assert.deepEqual(d850,[271,271,272],'комод 850: 271 / 271 / 272 (остаток 1 мм — верхнему, шаг 0,5 как у кухни)');
  // высокий комод: при трёх ящиках короб выше 300 — палитра берёт четыре, фасады равные
  const tall=createModule('drawers',600,1200,550,initialModule());assert.equal(tall.sections[0].drawers,4);assertEven(tall,'комод 1200');
});

test('правка 1: высота комода меняется — ящики снова до крыши и равные; ручная высота ящика — не трогается',()=>{
  const k=createModule('drawers',600,850,550,initialModule());assert.ok(isAutoDrawerLayout(k,k.sections[0]));
  for(const h of [1000,720,850]){const n=structuredClone(k);n.height=h;fitDrawersAfterResize(n,k);assert.deepEqual(validate(n),[]);assertEven(n,'комод → '+h);assert.ok(drawersFillRoof(n,n.sections[0]));}
  // ручная правка высоты ящика — расстановка уже не «по правилу»: пересчёт только при переполнении, как раньше
  const hand=initialModule();hand.doors=false;hand.sections[0].drawerConfigs=[{slide:'ball',height:140,length:500},{slide:'ball',height:190,length:500}];
  assert.ok(!isAutoDrawerLayout(hand,hand.sections[0]));
  const taller=structuredClone(hand);taller.height=2200;fitDrawersAfterResize(taller,hand);
  assert.deepEqual(taller.sections[0].drawerConfigs,hand.sections[0].drawerConfigs,'ручные высоты сохранены');
  // те же ящики по правилу (одинаковые короба) — после смены высоты фасады выравниваются
  const auto=initialModule();auto.doors=false;const t2=structuredClone(auto);t2.height=2200;fitDrawersAfterResize(t2,auto);assertEven(t2,'по правилу после высоты');
});

test('правка 1: число ящиков комода +/− — все снова поровну на весь проём; insertItem и «Удалить ящик» так же',()=>{
  const k=createModule('drawers',600,850,550,initialModule()),sid=k.sections[0].id;
  assert.ok(roofDrawers(k,k.sections[0]));
  const four=structuredClone(k);setDrawerCount(four,sid,4);assert.equal(four.sections[0].drawers,4);assert.deepEqual(validate(four),[]);assertEven(four,'4 ящика');assert.ok(Math.abs(hi(faces(four).at(-1)!)-facadeTop(four))<0.01);
  const two=structuredClone(k);setDrawerCount(two,sid,2);assert.deepEqual(validate(two),[]);assertEven(two,'2 ящика');assert.ok(drawersFillRoof(two,two.sections[0]));
  // проект: «+» панели и меню (drawerFitsOnTop → insertItem) и удаление ящика правой кнопкой
  const p=newProject(k),mid=p.modules[0].id;
  assert.ok(drawerFitsOnTop(p,mid,sid),'в полный комод «+» добавляет (раньше — «нет места»)');
  const p4=insertItem(p,'drawer',mid,sid,500);assert.equal(p4.modules[0].module.sections[0].drawers,4);assertEven(p4.modules[0].module,'insertItem');
  const p2=removePart(p,mid,sid,sid+':drawer:1:bottom'),m2=p2.modules[0].module;assert.equal(m2.sections[0].drawers,2);assert.deepEqual(projectErrors(p2),[]);assertEven(m2,'удалён ящик');assert.ok(drawersFillRoof(m2,m2.sections[0]));
});

test('правка 1: шаблоны секции и ящик сверху в открытом корпусе — фасады равные; за дверью — как было',()=>{
  for(const tpl of ['drawers-rod','drawers-shelves'] as const){
    const open=assembleModule('wardrobe',800,2200,600,initialModule());open.doors=false;applySectionTemplate(open,open.sections[0].id,tpl);
    assert.deepEqual(validate(open),[]);assertEven(open,'без дверей, '+tpl);
    const door=assembleModule('wardrobe',800,2200,600,initialModule());applySectionTemplate(door,door.sections[0].id,tpl);
    assert.deepEqual(validate(door),[]);assert.ok(door.sections[0].drawerConfigs===undefined,'за дверью ящики по шагу — без настроек, как было');assert.ok(spread(faces(door))<=0.01);
  }
  // открытый корпус: «+» кладёт ящик поверх стопки, фасады снова равные
  const m=assembleModule('wardrobe',800,2200,600,initialModule());m.doors=false;applySectionTemplate(m,m.sections[0].id,'drawers-rod');
  const p=newProject(m),mid=p.modules[0].id,sid=m.sections[0].id;assert.ok(!roofDrawers(m,m.sections[0]));
  const n=insertItem(p,'drawer',mid,sid,boxes(m)[0].bottom+drawerStackHeight(m.sections[0])); // «+» панели: поверх стопкиassert.equal(n.modules[0].module.sections[0].drawers,3);assertEven(n.modules[0].module,'+1 в открытом корпусе');
  // шкаф с дверями (исходный модуль) не меняется: 177 / 177
  assert.deepEqual(faces(initialModule()).map(p=>p.size[1]),[177,177]);
});

test('правка 1: старый проект при загрузке не меняется; «Фасады поровну» — по запросу',()=>{
  const m=initialModule();m.doors=false;const s=m.sections[0];s.drawers=3;s.drawerConfigs=[0,1,2].map(j=>({slide:'ball' as const,height:140,length:500,y:j*180}));
  const before=JSON.stringify(parts(m)),loaded=parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(JSON.stringify(parts(loaded)),before,'детали старого проекта те же');
  assert.ok(!drawerFacesEqual(loaded,loaded.sections[0]),'нижний фасад был длиннее (до цоколя)');
  const e=evenDrawerConfigs(loaded,loaded.sections[0])!;assert.ok(e);loaded.sections[0].drawerConfigs=e;assertEven(loaded,'по запросу');assert.deepEqual(validate(loaded),[]);
});

test('правка 2: один выкатной ящик на всю секцию антресоли — фасад вместо двери, короб под высоту, направляющие по глубине, смета',()=>{
  const base=initialModule();base.height=2000;
  const p0=newProject(base),p=addUpperModule(p0,p0.modules[0].id),a=p.modules[1].module,sid=a.sections[0].id;
  assert.ok(parts(a).some(x=>x.role==='door'),'антресоль с дверью');
  const hinges0=estimate(p).lines.filter(l=>/^hinge/.test(l.id)).reduce((s,l)=>s+l.quantity,0);
  const m=structuredClone(a);fullSectionDrawer(m,sid);
  const ps=parts(m),b=boxes(m)[0],f=ps.find(x=>x.id===sid+':drawer:0:facade')!;
  assert.deepEqual(validate(m),[]);assert.equal(m.sections[0].drawers,1);
  assert.ok(!ps.some(x=>x.role==='door'&&x.sectionId===sid),'двери в секции нет');assert.ok(!ps.some(x=>x.role==='hinge'&&x.sectionId===sid),'петель нет');
  assert.ok(Math.abs(lo(f)-facadeBottom(m))<0.01&&Math.abs(hi(f)-facadeTop(m))<0.01,'фасад на всю высоту секции');
  assert.ok(Math.abs(f.size[0]-(m.width-2*RULES.faceGap))<0.01,'фасад во всю ширину, как дверь');assert.ok(f.position[2]>m.depth,'накладной');
  const side=ps.find(x=>x.id===sid+':drawer:0:left')!;assert.equal(side.size[1],Math.min(300,b.top-b.bottom-RULES.drawerStep),'короб под высоту секции');
  const len=m.sections[0].drawerConfigs![0].length;assert.equal(len,[...SLIDES.ball.lengths].reverse().find(l=>l<=m.depth-25),'направляющая — самая длинная по глубине');
  const q=newProject(m);q.modules[0]={...q.modules[0],module:m};
  const kits=estimate(q).lines.filter(l=>l.id.startsWith('slide:'));assert.equal(kits.reduce((s,l)=>s+l.quantity,0),1);assert.ok(kits.every(l=>l.unit==='компл'));
  const pp=structuredClone(p);pp.modules[1].module=m;assert.ok(estimate(pp).lines.filter(l=>/^hinge/.test(l.id)).reduce((s,l)=>s+l.quantity,0)<hinges0,'петли двери антресоли ушли из сметы');
  // высота антресоли меняется — ящик по-прежнему на всю секцию
  for(const h of [450,350]){const n=structuredClone(m);n.height=h;fitDrawersAfterResize(n,m);assert.deepEqual(validate(n),[]);const nf=faces(n)[0];assert.ok(Math.abs(hi(nf)-facadeTop(n))<0.01&&Math.abs(lo(nf)-facadeBottom(n))<0.01,'антресоль '+h);assert.ok(!parts(n).some(x=>x.role==='door'));}
  // шаблон меню «Наполнение › Ящик на всю секцию» — то же
  const t=structuredClone(a);applySectionTemplate(t,sid,'drawer-full');assert.deepEqual(t.sections[0],m.sections[0]);
  // второй ящик в ту же секцию — оба до крыши, равные
  const two=structuredClone(m);setDrawerCount(two,sid,2);assert.deepEqual(validate(two),[]);assertEven(two,'антресоль, 2 ящика');assert.ok(!parts(two).some(x=>x.role==='door'));
  // секция без дверей (стеллаж) — тоже
  const open=structuredClone(a);open.doors=false;fullSectionDrawer(open,sid);assert.deepEqual(validate(open),[]);
});

test('правка 3: ящики в накладку — фасады в плоскости дверей, дверь короче над ящиками через зазор, петли по новой высоте; обратно — за дверь',()=>{
  for(const h of [2000,850]){ // шкаф и тумба
    const m=initialModule();m.height=h;m.sections=[{...section(),drawers:2}];const sid=m.sections[0].id;if(h<1000)m.sections[0].drawers=2;
    const door0=parts(m).find(p=>p.role==='door')!,hinges0=parts(m).filter(p=>p.id.includes(':hingecup:')).length;
    setDrawersOverlay(m,sid,true);
    const ps=parts(m),door=ps.find(p=>p.role==='door')!,fs=faces(m),hs=ps.filter(p=>p.id.includes(':hingecup:'));
    assert.deepEqual(validate(m),[],'h '+h);
    assert.ok(fs.every(f=>Math.abs(f.position[2]-door.position[2])<0.01),'фасады ящиков в плоскости двери');
    assert.ok(Math.abs(lo(door)-hi(fs.at(-1)!)-RULES.faceGap)<0.01,'зазор фасад ящика — дверь как между фасадами');
    assert.ok(door.size[1]<door0.size[1]-300,'дверь укоротилась');assertEven(m,'в накладку '+h);
    assert.ok(Math.abs(lo(fs[0])-facadeBottom(m))<0.01,'нижний фасад до цоколя');
    assert.ok(hs.length>0&&hs.every(x=>x.position[1]>lo(door)&&x.position[1]<hi(door)),'петли в пределах новой двери');
    assert.ok(hs.length<=hinges0);assert.ok(!ps.some(p=>p.id.includes(':filler:')),'фальшей у петель нет — ящики не за дверью');
    // смета: двери новых размеров и фасады ящиков
    const pr=newProject(m);pr.modules[0]={...pr.modules[0],module:m};assert.deepEqual(projectErrors(pr),[]);
    setDrawersOverlay(m,sid,false);const back=parts(m),d2=back.find(p=>p.role==='door')!;
    assert.deepEqual(validate(m),[]);assert.ok(Math.abs(d2.size[1]-door0.size[1])<0.01,'за дверью — дверь снова во всю высоту');
    assert.ok(faces(m).every(f=>f.position[2]<m.depth),'фасады ящиков за дверью');
  }
});

test('правка 3: меню ящика — «В накладку» / «За дверью»; «Фасады поровну» только когда разные',()=>{
  let m=initialModule();const sid=m.sections[0].id;
  const ops:QuickMenuOps={modify:u=>{const n=structuredClone(m);u(n);m=n;},addUpper:()=>{}};
  const it=drawerQuickItems(m,sid,ops);assert.deepEqual(it.map(i=>i.label),['В накладку']);
  it[0].run!();assert.equal(m.sections[0].externalDrawers,true);assert.deepEqual(validate(m),[]);assertEven(m,'меню');
  const again=drawerQuickItems(m,sid,ops);assert.equal(again[0].label,'За дверью');assert.ok(again[0].active);
  again[0].run!();assert.equal(m.sections[0].externalDrawers,undefined);
  // старый открытый корпус с неравными фасадами — пункт «Фасады поровну»
  const old=initialModule();old.doors=false;old.sections[0].drawerConfigs=[{slide:'ball',height:140,length:500},{slide:'ball',height:140,length:500}];
  let o=old;const ev=drawerQuickItems(o,old.sections[0].id,{modify:u=>{const n=structuredClone(o);u(n);o=n;},addUpper:()=>{}}).find(i=>i.id==='drawer-even')!;
  assert.ok(ev);ev.run!();assertEven(o,'Фасады поровну');
});
