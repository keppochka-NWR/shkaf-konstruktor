// Макс 31.10.2026: «Как у нас работает редактирование наполнения при выделении нескольких модулей?» — «Наполнение как у этого»:
// наполнение выбранного модуля отмеченным (src/groupFilling.ts), одна правка проекта, несовместимые — с причиной.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,type Project,type PlacedModule} from '../src/project';
import {initialModule,validate,boxes,drawerConfig,rearClear,drawersBehindDoors,splitSection,type Module} from '../src/model';
import {createModule,createKupeModule} from '../src/paletteBuild';
import {applySectionTemplate} from '../src/quickMenu';
import {estimate} from '../src/pricing';
import {applyGroupFilling,fillingCompat,FILL_KEYS,FILL_WIDTH_TOL} from '../src/groupFilling';

const base=(()=>{const w=createModule('wardrobe',1000,2100,600,initialModule());return splitSection(w,w.sections[0].id);})();
/** Образец — первый шкаф с наполнением по секциям: ящики+полки, штанга+полка, …; цели — копии других размеров и чужие модули. */
function source():Module{
  const m=structuredClone(base);
  const kinds=['drawers-shelves','rod-shelf','shelves5','drawers-rod'] as const;
  m.sections.forEach((s,i)=>applySectionTemplate(m,s.id,kinds[i%kinds.length]));
  m.sections[0].shelfLights=[0];
  assert.deepEqual(validate(m),[]);
  return m;
}
function room(extra:Record<string,Module>={}):Project{
  const p=newProject();let x=50;const mods:PlacedModule[]=[];
  const put=(id:string,m:Module)=>{mods.push({id,x,z:30,y:0,rotation:0,module:m});x+=m.width+300;};
  const src=source();
  put('src',src);
  put('same',{...structuredClone(base),facadeDecor:'Графит',name:'Такой же'});
  put('tall',{...structuredClone(base),height:Math.min(2400,base.height+300),name:'Выше'});
  put('shallow',{...structuredClone(base),depth:450,name:'Мельче'});
  put('one',createModule('wardrobe',800,2100,600,base));
  put('kupe',createKupeModule(1800,2400,base));
  for(const [id,m] of Object.entries(extra))put(id,m);
  return {...p,room:{...p.room,width:20000,depth:4000},modules:mods};
}
const mod=(p:Project,id:string)=>p.modules.find(a=>a.id===id)!.module;
const fill=(m:Module)=>m.sections.map(s=>Object.fromEntries(FILL_KEYS.filter(k=>s[k]!==undefined&&k!=='drawerConfigs').map(k=>[k,s[k]])));

test('образец с несколькими секциями (иначе тест ни о чём)',()=>{assert.ok(base.sections.length>=2,'у первого шкафа 2+ секции');});

test('«Наполнение как у этого»: такой же корпус получает наполнение образца, двери/материалы/размеры свои',()=>{
  const p=room(),r=applyGroupFilling(p,'src',['src','same']);
  assert.deepEqual(r.changed,['same']);assert.deepEqual(r.skipped,[]);
  const t=mod(r.project,'same'),s=mod(p,'src'),was=mod(p,'same');
  assert.deepEqual(fill(t),fill(s));
  assert.deepEqual(t.sections.map(x=>x.drawers),s.sections.map(x=>x.drawers));
  assert.equal(t.facadeDecor,'Графит');assert.equal(t.width,was.width);assert.equal(t.height,was.height);assert.equal(t.name,'Такой же');
  assert.deepEqual(t.sections.map(x=>x.id),was.sections.map(x=>x.id),'id секций — свои');
  assert.deepEqual(validate(t),[]);
  // образец не меняется
  assert.deepEqual(mod(r.project,'src'),s);
});

test('другая высота — полки и штанга по доле проёма, ящики по правилу заново; другая глубина — направляющие по глубине',()=>{
  const p=room(),r=applyGroupFilling(p,'src',['src','tall','shallow']);
  assert.deepEqual([...r.changed].sort(),['shallow','tall']);
  const t=mod(r.project,'tall'),s=mod(p,'src');
  assert.deepEqual(t.sections.map(x=>x.shelves),s.sections.map(x=>x.shelves),'доли высоты те же');
  assert.deepEqual(validate(t),[]);
  const sh=mod(r.project,'shallow');assert.deepEqual(validate(sh),[]);
  for(const sec of sh.sections)for(let j=0;j<sec.drawers;j++){const c=drawerConfig(sh,sec,j);assert.ok(c.length<=sh.depth-rearClear(sh)-(drawersBehindDoors(sh,sec)?44:25),'направляющие '+c.length+' в глубину '+sh.depth);}
});

test('несовместимые — пропуск с причиной, остальные применены; ничего не подошло — ошибка с причиной',()=>{
  const p=room(),r=applyGroupFilling(p,'src',['src','same','one','kupe']);
  assert.deepEqual(r.changed,['same']);
  const why=Object.fromEntries(r.skipped.map(s=>[s.id,s.reason]));
  assert.match(why.one,/другое число секций/);assert.match(why.kupe,/двери купе/);
  assert.throws(()=>applyGroupFilling(p,'src',['src','one','kupe']),/Не применено ни к одному/);
  assert.throws(()=>applyGroupFilling(p,'kupe',['kupe','same']),/не переносится: двери купе/);
  assert.throws(()=>applyGroupFilling(p,'src',['src']),/Отметьте/);
});

test('ширина секции вне допуска — пропуск «секция N шире на …»',()=>{
  const wide={...structuredClone(base),width:base.width+(FILL_WIDTH_TOL+10)*base.sections.length,name:'Шире'},near={...structuredClone(base),width:base.width+50*base.sections.length,name:'Чуть шире'};
  assert.deepEqual(validate(wide),[]);
  const p=room({wide,near});
  assert.ok(boxes(wide)[0].width-boxes(base)[0].width>FILL_WIDTH_TOL);
  assert.match(fillingCompat(mod(p,'src'),wide)??'',/секция 1 шире на \d+ мм/);
  assert.equal(fillingCompat(mod(p,'src'),near),null,'±'+FILL_WIDTH_TOL+' мм — подходит');
});

test('одна правка: меняются только целевые модули, цена остальных та же; повтор — «уже так»',()=>{
  const p=room(),r=applyGroupFilling(p,'src',['src','same','one']);
  for(const a of p.modules)if(!r.changed.includes(a.id))assert.deepEqual(mod(r.project,a.id),a.module,a.id+' не тронут');
  const only=(q:Project,id:string)=>estimate({...q,modules:q.modules.filter(a=>a.id===id)}).retail;
  for(const id of ['src','one','kupe'])assert.equal(only(r.project,id),only(p,id),id);
  const again=applyGroupFilling(r.project,'src',['src','same']);
  assert.deepEqual(again.changed,[]);assert.deepEqual(again.skipped,[]);
});

test('вырез на полке цели — не снимаем молча, пропуск с причиной',()=>{
  const p=room(),t=mod(p,'same'),sid=t.sections.find(s=>s.shelves.length)?.id;
  if(!sid)return;
  t.cutouts=[{id:'c1',host:sid+':shelf:0',shape:'rect',w:50,h:50,u:20,v:20,fromU:'min',fromV:'min'} as NonNullable<Module['cutouts']>[number]];
  assert.match(fillingCompat(mod(p,'src'),t)??'',/вырезы/);
});
