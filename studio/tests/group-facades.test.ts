// Решение Макса 29.10.2026: «не мог выбрать нужные мне модули и отредактировать на них фасады за раз» — групповое редактирование фасадов
// отмеченных модулей (src/groupFacades.ts). Ветка claude/rotate-group-facades.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,applyAutoFillers,type Project,type PlacedModule} from '../src/project';
import {initialModule,validate,parts,type Module} from '../src/model';
import {createModule,createKupeModule} from '../src/paletteBuild';
import {catalog} from '../src/catalog';
import {estimate} from '../src/pricing';
import {placeInRow} from '../src/rowResize';
import {DEFAULT_HANDLE,HANDLES} from '../src/handles';
import {setFacadeKind} from '../src/facadeKind';
import {applyFacadeAppearance} from '../src/facadeAppearance';
import {applyGroupFacade,applyGroupPatch,groupFacadeValue,groupPatchMixed,changedKeys,skippedNote,GROUP_FIELDS} from '../src/groupFacades';

const src=initialModule();
const decors=catalog.map(c=>c.n).filter(n=>n!==src.facadeDecor);
const handle2=HANDLES.find(h=>h.id!==DEFAULT_HANDLE&&h.vendor==='workshop'&&h.len<=160)!.id;
/** Три шкафа с разными декором/ручками/петлями, комод, открытый стеллаж (без дверей) и двери купе — в ряд у задней стены. */
function room():Project{
  const p=newProject();let x=50;
  const put=(id:string,m:Module):PlacedModule=>{const a={id,x,z:30,y:0,rotation:0,module:m};x+=m.width+300;return a;};
  const w1=createModule('wardrobe',800,2100,600,src),w2={...createModule('wardrobe',900,2100,600,src),facadeDecor:decors[0],handleId:handle2},w3={...createModule('wardrobe',600,2100,600,src),hingeBrand:'blum' as const};
  const drawers=createModule('drawers',800,900,500,src),shelves={...createModule('shelves',800,2000,400,src),doors:false},kupe=createKupeModule(1800,2400,src);
  for(const m of [w1,w2,w3,drawers,shelves,kupe])assert.deepEqual(validate(m),[],m.name);
  return {...p,room:{...p.room,width:12000,depth:4000},modules:[put('w1',w1),put('w2',w2),put('w3',w3),put('dr',drawers),put('sh',shelves),put('ku',kupe)]};
}
const ALL=['w1','w2','w3','dr','sh','ku'];
const mod=(p:Project,id:string)=>p.modules.find(a=>a.id===id)!.module;
/** Как менеджер по одному: правка в панели корпуса — modify → commit → placeInRow → commitProject (угловые фальши). */
function oneByOne(p:Project,ids:string[],edit:(n:Module)=>void,skip:(m:Module)=>boolean=()=>false):Project{
  let n=p;for(const id of ids){const m=mod(n,id);if(skip(m))continue;const next=structuredClone(m);edit(next);n=applyAutoFillers(placeInRow(n,id,next));}return n;
}
const price=(p:Project)=>{const e=estimate(applyAutoFillers(p));return {retail:e.retail,lines:e.lines.map(l=>[l.id,l.quantity,l.unitPrice])};};

test('«разные»: у отмеченных разный декор фасадов → null; одинаковый бренд петель у части → значение',()=>{
  const p=room();
  assert.equal(groupFacadeValue(p,['w1','w2','w3'],'facadeDecor').value,null,'декор разный — «разные»');
  assert.equal(groupFacadeValue(p,['w1','w3'],'facadeDecor').value,src.facadeDecor);
  assert.equal(groupFacadeValue(p,['w1','w2','w3'],'hingeBrand').value,null);
  assert.equal(groupFacadeValue(p,['w1','w2'],'hingeBrand').value,'gtv');
  const all=groupFacadeValue(p,ALL,'handle');assert.equal(all.total,6);assert.equal(all.applicable,3,'ручки дверей — только у шкафов (комод без дверей, стеллаж, купе — нет)');
});

test('декор фасадов группе: меняется только декор фасадов, купе и стеллаж без дверей — «не применено» с причиной; цена — как по одному',()=>{
  const p=room(),d=decors[3];
  const r=applyGroupFacade(p,ALL,'facadeDecor',d);
  assert.deepEqual(r.changed.sort(),['dr','w1','w2','w3']);
  assert.deepEqual(r.skipped.map(s=>[s.id,s.reason]),[['sh','нет фасадов'],['ku','двери купе']]);
  assert.match(skippedNote(r.skipped),/^К 2 модулям не применено: нет фасадов \(.+\); двери купе \(.+\)\.$/);
  for(const id of ALL){
    const before=mod(p,id),after=mod(r.project,id);
    if(r.changed.includes(id))assert.equal(after.facadeDecor,d);
    assert.deepEqual({...after,facadeDecor:null},{...before,facadeDecor:null},id+': остальные поля не тронуты');
  }
  assert.equal(groupFacadeValue(r.project,['w1','w2','w3'],'facadeDecor').value,d,'после правки — одно значение');
  // по одному — как кнопка декора в окне «Материалы» (n.facadeDecor = c.n) у каждого корпуса с фасадами
  const seq=oneByOne(p,['w1','w2','w3','dr'],n=>{n.facadeDecor=d;});
  assert.deepEqual(price(r.project),price(seq));
  assert.notDeepEqual(price(r.project).retail,null);
});

test('ручки группе: распашные фасады получают ручку, у ящиков своя остаётся; push без ручек — пропуск; цена — как по одному',()=>{
  const p=room();p.modules.find(a=>a.id==='w3')!.module.doorOpen='push';
  const r=applyGroupFacade(p,['w1','w2','w3','dr'],'handle',handle2);
  assert.deepEqual(r.changed,['w1','w2']);// у w2 та же ручка, но у ящиков появляется своя (drawerHandleId), как в окне «Ручки»
  assert.deepEqual(r.skipped.map(s=>[s.id,s.reason]),[['w3','открывание нажатием, без ручек'],['dr','нет распашных фасадов']]);
  assert.equal(mod(r.project,'w1').handleId,handle2);
  // по одному — как окно «Ручки» → «Распашных фасадов» (applyHandle в App.tsx)
  const seq=oneByOne(p,['w1','w2'],n=>{for(const s of n.sections)delete s.doorHandles;n.drawerHandleId??=n.handleId??DEFAULT_HANDLE;n.handleId=handle2;});
  assert.deepEqual(price(r.project),price(seq));
});

test('декор + ручки трём шкафам по очереди группой = по одному (цена до рубля и строки сметы)',()=>{
  const p=room(),ids=['w1','w2','w3'],d=decors[5];
  const g=applyGroupFacade(applyGroupFacade(p,ids,'facadeDecor',d).project,ids,'handle',handle2).project;
  const seq=oneByOne(oneByOne(p,ids,n=>{n.facadeDecor=d;}),ids,n=>{for(const s of n.sections)delete s.doorHandles;n.drawerHandleId??=n.handleId??DEFAULT_HANDLE;n.handleId=handle2;});
  assert.deepEqual(price(g),price(seq));
  assert.notDeepEqual(price(g),price(p),'цена изменилась (декор/ручки другие)');
});

test('петли, открывание, петли 155°, тип фасадов — только своё поле; цена как по одному',()=>{
  const p=room(),ids=['w1','w2','w3','dr','ku'];
  const brand=applyGroupFacade(p,ids,'hingeBrand','blum');
  assert.deepEqual(brand.changed,['w1','w2']);assert.deepEqual(brand.skipped.map(s=>s.id),['dr','ku']);
  assert.deepEqual(price(brand.project),price(oneByOne(p,['w1','w2'],n=>{n.hingeBrand='blum';})));
  const push=applyGroupFacade(p,ids,'doorOpen','push');
  for(const id of ['w1','w2','w3'])assert.equal(mod(push.project,id).doorOpen,'push');
  assert.deepEqual(price(push.project),price(oneByOne(p,['w1','w2','w3'],n=>{n.doorOpen='push';delete n.hingeSoft;})));
  const wide=applyGroupFacade(p,ids,'hingeAngle','165');
  assert.equal(groupFacadeValue(wide.project,['w1','w2','w3'],'hingeAngle').value,'165');
  const kind=applyGroupFacade(p,ids,'kind','vernissage');
  assert.deepEqual(kind.changed.sort(),['dr','w1','w2','w3']);
  assert.deepEqual(price(kind.project),price(oneByOne(p,['w1','w2','w3','dr'],n=>setFacadeKind(n,'vernissage'))));
});

test('Вернисаж группе: меняется только изменённое (плёнка), фрезеровка у каждого своя; не Вернисаж — пропуск',()=>{
  let p=applyGroupFacade(room(),['w1','w2','w3'],'kind','vernissage').project;
  p={...p,modules:p.modules.map(a=>a.id==='w2'?{...a,module:{...a.module,vernissage:{...a.module.vernissage!,milling:'4'}}}:a)};
  const mixed=groupPatchMixed(p,['w1','w2','w3','dr'],'vernissage');
  assert.deepEqual(mixed.mixed,['milling'],'разная только фрезеровка');assert.equal(mixed.count,3);
  const base=mod(p,'w1').vernissage!,next={...base,film:'Моно серый'};
  const patch=changedKeys(base,next) as Record<string,unknown>;assert.deepEqual(patch,{film:'Моно серый'});
  const r=applyGroupPatch(p,['w1','w2','w3','dr'],'vernissage',patch);
  assert.deepEqual(r.changed,['w1','w2','w3']);assert.deepEqual(r.skipped.map(s=>[s.id,s.reason]),[['dr','фасады не МДФ Вернисаж']]);
  assert.equal(mod(r.project,'w2').vernissage!.milling,'4','фрезеровка w2 осталась своя');
  assert.equal(mod(r.project,'w1').vernissage!.milling,base.milling);
  for(const id of ['w1','w2','w3'])assert.equal(mod(r.project,id).vernissage!.film,'Моно серый');
  assert.deepEqual(price(r.project),price(oneByOne(p,['w1','w2','w3'],n=>{n.vernissage={...n.vernissage!,film:'Моно серый'};n.facadeT=n.vernissage.thickness;})));
});

test('«Редактор фасадов» с областью «Выделенные модули»: переносится только изменённое (плёнка), фрезеровка и ручки — свои',()=>{
  let p=applyGroupFacade(room(),['w1','w2','w3'],'kind','vernissage').project;
  p={...p,modules:p.modules.map(a=>a.id==='w2'?{...a,module:{...a.module,vernissage:{...a.module.vernissage!,milling:'4'}}}:a)};
  const draft=structuredClone(mod(p,'w1'));draft.vernissage={...draft.vernissage!,film:'Моно серый'};
  const only=applyFacadeAppearance(p,'w1',draft,['w1','w2','w3'],true);
  assert.equal(mod(only,'w2').vernissage!.milling,'4','фрезеровка w2 своя');
  assert.equal(mod(only,'w2').handleId,handle2,'ручка w2 своя');
  for(const id of ['w1','w2','w3'])assert.equal(mod(only,id).vernissage!.film,'Моно серый');
  // прежнее поведение («все модули», кнопка «Применить ко всем модулям») — копия оформления целиком
  const all=applyFacadeAppearance(p,'w1',draft,['w1','w2','w3']);
  assert.equal(mod(all,'w2').vernissage!.milling,mod(p,'w1').vernissage!.milling);
});

test('ни один не подходит — понятная ошибка, проект не меняется; поле без значения у корпуса — ничего не меняет',()=>{
  const p=room();
  assert.throws(()=>applyGroupFacade(p,['sh','ku'],'hingeBrand','blum'),/Не применено ни к одному.*К 2 модулям не применено/);
  const same=applyGroupFacade(p,['w1'],'hingeBrand','gtv');assert.deepEqual(same.changed,[]);assert.equal(same.project,p);
  // у каждого поля есть подпись и правка
  for(const f of Object.values(GROUP_FIELDS)){assert.ok(f.label);assert.equal(typeof f.apply,'function');}
  // дверей 3 шкафов — по ручке на створку после группы
  const r=applyGroupFacade(p,['w1','w2','w3'],'handle',handle2).project;
  for(const id of ['w1','w2','w3'])assert.ok(parts(mod(r,id)).filter(x=>x.id.includes(':handle:')).length>0);
});
