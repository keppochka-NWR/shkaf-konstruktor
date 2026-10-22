// Волна 22.10, ветка claude/w-ui: Esc/WASD (п.19, 28), полки числом (п.17), ошибки списком (п.4), двери в палитре (п.21), полка над ящиками (п.29).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,validate,parts,parseModule,boxes,facadeTop,hasDrawerCap,drawersFillRoof,fitDrawersAfterResize,RULES} from '../src/model';
import {newProject,projectErrors,type Project} from '../src/project';
import {viewShortcut} from '../src/historyShortcuts';
import {maxEvenShelves,setShelfCount} from '../src/shelfCount';
import {explainErrors,errorPlace} from '../src/errorDetails';
import {doorCountOptions,withDoorCount,MIN_LEAF} from '../src/paletteDoors';
import {createModule,createKupeModule,createKupeWardrobe} from '../src/ModulePalette';

const key=(code:string,extra:Partial<KeyboardEvent>={})=>({code,key:code.slice(3).toLowerCase(),ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,target:null,...extra}) as unknown as KeyboardEvent;

test('п.28: W/A/S/D/Q/E — виды сцены по физической клавише; с модификаторами и автоповтором — нет',()=>{
  assert.equal(viewShortcut(key('KeyW')),'top');assert.equal(viewShortcut(key('KeyS')),'front');
  assert.equal(viewShortcut(key('KeyA')),'left');assert.equal(viewShortcut(key('KeyD')),'side');
  assert.equal(viewShortcut(key('KeyQ')),'iso');assert.equal(viewShortcut(key('KeyE')),'iso');
  assert.equal(viewShortcut(key('KeyW',{ctrlKey:true})),null);assert.equal(viewShortcut(key('KeyS',{shiftKey:true})),null);
  assert.equal(viewShortcut(key('KeyD',{repeat:true})),null);assert.equal(viewShortcut(key('KeyZ')),null);
});

test('п.17: число полок — поровну, предел по высоте с проёмом 80 мм, жёсткость остаётся у полок с теми же номерами',()=>{
  const m=initialModule();m.sections=[section()];m.doors=false;const s=m.sections[0];
  const most=maxEvenShelves(m,s);assert.ok(most>=5&&most<=RULES.maxShelves);
  setShelfCount(m,s,5);assert.equal(s.shelves.length,5);assert.deepEqual(validate(m),[]);
  const h=m.height-80-2*RULES.panel,ys=s.shelves.map(f=>f*h),gaps=ys.map((y,j)=>y-(j?ys[j-1]:0));
  assert.ok(Math.max(...gaps.slice(1))-Math.min(...gaps.slice(1))<=1,'равные шаги');
  s.fixed=[0,4];setShelfCount(m,s,3);assert.deepEqual(s.fixed,[0]);
  setShelfCount(m,s,most);assert.deepEqual(validate(m),[]);
  const over=structuredClone(m);setShelfCount(over,over.sections[0],most+1);
  if(most+1<=RULES.maxShelves)assert.ok(validate(over).length,'на одну больше предела — ошибка проверки');
  setShelfCount(m,s,0);assert.deepEqual(s.shelves,[]);assert.equal(s.fixed,undefined);
});

test('п.4: ошибки — корпус, секция, деталь и «что сделать»; исходные тексты не меняются',()=>{
  const p=newProject();const a=p.modules[0];a.module.name='Шкаф тест';a.module.sections=[section()];a.module.sections[0].drawers=5;a.module.height=600;
  const errs=projectErrors(p);assert.ok(errs.length);
  const d=explainErrors(p,errs);
  assert.equal(d[0].text,errs[0]);assert.equal(d[0].moduleId,a.id);assert.equal(d[0].sectionNo,1);assert.equal(d[0].sectionId,a.module.sections[0].id);
  assert.ok(d.every(x=>x.action.length>0),'у каждой ошибки есть «что сделать»');
  assert.match(errorPlace(d[0]),/^Шкаф тест · секция 1/);
  // широкий фасад — найдена дверь
  const w:Project=newProject();const b=w.modules[0];b.module.sections=[section()];b.module.sections[0].doorLeaves=1;b.module.width=900;
  const we=explainErrors(w,projectErrors(w)).find(x=>/Фасад шире/.test(x.text));
  assert.ok(we?.partId?.includes(':door:'),'деталь — дверь');
});

test('п.21: двери при добавлении — допустимые по ширине, секции под двери, купе — число полотен',()=>{
  const base=createModule('empty',1200,2000,550,initialModule());
  const opts=doorCountOptions(base);
  assert.ok(!opts.includes(1),'одна створка 1200 — шире 600');assert.ok([2,3,4].every(n=>opts.includes(n)));
  for(const n of opts){const m=withDoorCount(base,n);assert.deepEqual(validate(m),[]);const doors=parts(m).filter(p=>p.role==='door');assert.equal(doors.length,n);assert.ok(doors.every(p=>p.width>=MIN_LEAF));}
  const three=createModule('wardrobe',1200,2000,550,initialModule(),3);
  assert.equal(three.sections.length,2);assert.deepEqual(three.sections.map(s=>s.doorLeaves),[2,1]);assert.ok(three.sections.every(s=>s.rod));
  assert.deepEqual(validate(three),[]);
  // авто — как раньше
  assert.deepEqual(createModule('empty',600,2000,550,initialModule()).sections.length,1);
  assert.equal(createKupeModule(2400,2400,initialModule(),3).kupe!.doors,3);
  assert.equal(createKupeModule(1600,2400,initialModule()).kupe!.doors,2);
  assert.equal(createKupeWardrobe(2400,2400,600,initialModule(),3).find(a=>a.module.kupe)!.module.kupe!.doors,3);
});

test('п.29: комод — ящики до крыши без полки, верхний фасад до верха; явная полка; авто у шкафа как раньше',()=>{
  const k=createModule('drawers',600,850,550,initialModule()),s=k.sections[0];
  assert.deepEqual(validate(k),[]);assert.ok(drawersFillRoof(k,s));assert.equal(hasDrawerCap(k,s),false);
  const ps=parts(k);assert.ok(!ps.some(p=>p.id.endsWith(':drawer-cap')));
  const top=ps.filter(p=>/:drawer:\d+:facade$/.test(p.id)).reduce((x,p)=>Math.max(x,p.position[1]+p.size[1]/2),0);
  assert.ok(Math.abs(top-facadeTop(k))<0.01,'верхний фасад до верха накладных фасадов');
  const capped=structuredClone(k);capped.sections[0].drawerCap=true;assert.ok(validate(capped).some(e=>/не помещаются по высоте/.test(e)));
  // обычный шкаф с ящиками внизу — полка есть, как раньше
  const w=initialModule();assert.equal(hasDrawerCap(w,w.sections[0]),true);assert.ok(parts(w).some(p=>p.id.endsWith(':drawer-cap')));
  const off=structuredClone(w);off.sections[0].drawerCap=false;assert.deepEqual(validate(off),[]);assert.ok(!parts(off).some(p=>p.id.endsWith(':drawer-cap')));
  assert.equal(parseModule(JSON.parse(JSON.stringify(off))).sections[0].drawerCap,false);
  assert.equal(parseModule(JSON.parse(JSON.stringify(w))).sections[0].drawerCap,undefined);
  // высота комода меняется — ящики снова до крыши
  const taller=structuredClone(k);taller.height=1000;fitDrawersAfterResize(taller,k);
  assert.ok(drawersFillRoof(taller,taller.sections[0]));assert.deepEqual(validate(taller),[]);
  const b=boxes(taller)[0];assert.ok(taller.sections[0].drawerConfigs!.every(c=>c.height<=300));void b;
});
