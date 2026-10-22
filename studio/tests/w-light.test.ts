// Задачи 14 и 20 (менеджеры 22.10.2026): редактор подсветки — ориентация в режиме выбора, тон (3000/4000/6000 К) и тип (врезной /
// накладной профиль / лента) на модуль и на деталь, список с длинами, «убрать»; смета/КП — описанием строки, цена прежняя; старые
// проекты — та же смета. Пересечение подсветки с петлями: LED в стойке — передняя кромка в 100 мм от переда, над ящиками; 0 пересечений.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,boxes,parts,parseModule,RULES,drawerStackHeight,type Module} from '../src/model';
import {newProject,parseProject,type Project} from '../src/project';
import {removePart,insertItem} from '../src/operations';
import {estimate} from '../src/pricing';
import {createModule,type ModuleKind} from '../src/ModulePalette';
import {partCollisions,hingeCollisions} from '../src/collisions';
import {lightItem,type QuickMenuOps} from '../src/quickMenu';
import {lightKeys,lightTargets,pickTargets,toggleDetailLight,setAllStands,setSectionShelves,setLight,setModuleLight,setDetailSpec,applyToAll,lightList,ledLook,lightSummary,clearLights} from '../src/lights';
import {describeModule} from '../src/quoteDescribe';

const wardrobe=():Module=>{const m:Module={...initialModule(),name:'Шкаф',width:1200,height:2400,depth:600,doors:true,sections:[section(),section()]};m.sections[0].shelves=[0.25,0.5,0.75];m.sections[1].shelves=[0.4,0.8];return m;};
function project(m:Module):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:200,y:0,z:200,rotation:0,module:m}];return p;}
const lightAll=(m:Module)=>{setAllStands(m,true);for(const s of m.sections){setSectionShelves(m,s.id,true);s.topLight=true;}return m;};
const leds=(m:Module)=>parts(m).filter(p=>p.role==='light'&&!p.id.startsWith('groove:'));
const lightLines=(p:Project)=>estimate(p).lines.filter(l=>l.id.startsWith('light-')).map(l=>({id:l.id,name:l.label,q:Math.round(l.quantity*1000)/1000,price:l.unitPrice}));

test('задача 20: вертикальный LED — передняя кромка в 100 мм от переда (за планкой петли), длина та же; в секции с ящиками — над ящиками',()=>{
  assert.equal(RULES.lightFrontOffset,100);
  const m=wardrobe(),[a]=m.sections.map(s=>s.id),b0=boxes(m)[0];setLight(m,`${a}:stand:left`,true);
  const l=parts(m).find(p=>p.id===`${a}:light:left`)!;
  assert.equal(Math.round((m.depth-(l.position[2]+l.size[2]/2))*10)/10,100,'передняя кромка — 100 от переда');
  assert.equal(Math.round((m.depth-(l.position[2]-l.size[2]/2))*10)/10,115,'задняя кромка — 115');
  assert.ok(Math.abs(l.length-(b0.top-b0.bottom))<0.01,'на всю высоту проёма — смета та же');
  // секция с ящиками: на стойках направляющие — LED над обязательной полкой над ящиками
  const d=wardrobe(),[da]=d.sections.map(s=>s.id);d.sections[0].drawers=2;d.sections[0].shelves=[0.6];setLight(d,`${da}:stand:right`,true);
  const bd=boxes(d)[0],ld=parts(d).find(p=>p.id===`${da}:light:right`)!,from=bd.bottom+drawerStackHeight(d.sections[0])+RULES.panel;
  assert.ok(Math.abs(ld.position[1]-ld.size[1]/2-from)<0.01,'низ LED — верх полки над ящиками');assert.ok(Math.abs(ld.position[1]+ld.size[1]/2-bd.top)<0.01);
});

test('задача 20: подсветка во всех стойках, полках и под крышей шаблонов × петли (накладные/вкладные) × полкодержатели × тип — 0 пересечений',()=>{
  const kinds:[ModuleKind,number,number,number][]=[['empty',800,2200,600],['shelves',800,2000,400],['wardrobe',1000,2200,600],['drawers',600,850,550]];
  const cases:[string,Module][]=[];
  for(const [k,w,h,d] of kinds)cases.push([k,createModule(k,w,h,d,initialModule())]);
  cases.push(['шкаф 1200 две секции',wardrobe()]);
  const fixedShelves=wardrobe();fixedShelves.sections[0].fixed=[1];cases.push(['жёсткая полка',fixedShelves]);
  const drawers=wardrobe();drawers.sections[1].drawers=3;cases.push(['ящики во 2-й секции',drawers]);
  let checked=0,ledN=0;
  for(const [name,base] of cases)for(const mount of [undefined,'inset'] as const)for(const type of ['inset','surface','tape'] as const){
    const m=structuredClone(base);m.doors=true;if(mount)m.doorMount=mount;else delete m.doorMount;
    lightAll(m);setModuleLight(m,{type});
    const ps=parts(m),c=partCollisions(ps,m);
    const bad=c.filter(x=>/light/.test(x.a+' '+x.b));
    assert.deepEqual(bad.map(x=>`${x.a} × ${x.b} ${x.depth}`),[],`${name} ${mount??'overlay'} ${type}`);
    assert.deepEqual(hingeCollisions(c).map(x=>`${x.a} × ${x.b}`),[],`${name} ${mount??'overlay'} ${type}: петли`);
    assert.ok(ps.some(p=>p.id.startsWith('shp:'))||!m.sections.some(s=>s.shelves.length),`${name}: полкодержатели на месте`);
    checked++;ledN+=leds(m).length;
  }
  assert.ok(checked>=40&&ledN>200,`проверено ${checked} вариантов, ${ledN} LED`);
});

test('задача 20: подсветка не сдвигает петли (высоты планок те же, что без подсветки)',()=>{
  for(const mount of [undefined,'inset'] as const){
    const plain=wardrobe();if(mount)plain.doorMount=mount;const lit=lightAll(structuredClone(plain));
    const hp=(m:Module)=>parts(m).filter(p=>p.id.includes(':hingeplate:')).map(p=>p.id+'@'+p.position.map(v=>Math.round(v)).join(','));
    assert.deepEqual(hp(lit),hp(plain));
  }
});

test('задача 14: переключатель «ставить: вертикаль / горизонталь / обе» — клик по перегородке/полке ставит нужное',()=>{
  const m=wardrobe(),[a,b]=m.sections.map(s=>s.id);
  assert.deepEqual(lightTargets(m,`${b}:divider`,'vertical'),[`${a}:stand:right`,`${b}:stand:left`]);
  assert.deepEqual(lightTargets(m,`${b}:divider`,'horizontal'),[],'горизонталь — перегородку пропускает');
  assert.deepEqual(lightTargets(m,`${a}:shelf:1`,'vertical'),[],'вертикаль — полку пропускает');
  assert.deepEqual(lightTargets(m,`${a}:shelf:1`,'horizontal'),[`${a}:shelf:1`]);
  assert.deepEqual(lightTargets(m,'top','horizontal'),[`${a}:top`,`${b}:top`]);
  assert.deepEqual(lightTargets(m,'left','both'),[`${a}:stand:left`]);
  // по лучу: в режиме «вертикаль» кромка полки у стойки пропускается — подсветка в стойку за ней
  assert.deepEqual(pickTargets(m,[`${a}:shelf:0`,'left'],'vertical'),{pid:'left',keys:[`${a}:stand:left`]});
  assert.deepEqual(pickTargets(m,[`${a}:shelf:0`,'left'],'horizontal'),{pid:`${a}:shelf:0`,keys:[`${a}:shelf:0`]});
  assert.equal(pickTargets(m,['back'],'both'),null);
});

test('задача 14: тон и тип — модуль и деталь; список с ориентацией и длинами; «убрать»; файл проекта',()=>{
  const m=wardrobe(),[a,b]=m.sections.map(s=>s.id);
  toggleDetailLight(m,'left');toggleDetailLight(m,`${a}:shelf:0`);toggleDetailLight(m,`${a}:shelf:2`);toggleDetailLight(m,'top');
  let rows=lightList(m);
  assert.deepEqual(rows.map(r=>[r.section,r.label,r.orient]),[[1,'Левая стойка','vertical'],[1,'Полка 1','horizontal'],[1,'Полка 3','horizontal'],[1,'Под крышей','horizontal'],[2,'Под крышей','horizontal']]);
  const b0=boxes(m)[0];assert.equal(rows[0].length,Math.round(b0.top-b0.bottom));assert.equal(rows[1].length,Math.round(b0.width-40));
  assert.ok(rows.every(r=>r.tone===4000&&r.type==='inset'&&!r.ownTone&&!r.ownType),'по умолчанию: нейтральный, врезной, не выбрано');
  setModuleLight(m,{tone:6000,type:'surface'});setDetailSpec(m,`${a}:shelf:2`,{tone:3000});
  rows=lightList(m);
  assert.deepEqual(rows.map(r=>`${r.tone}/${r.type}/${r.ownTone}`),['6000/surface/false','6000/surface/false','3000/surface/true','6000/surface/false','6000/surface/false']);
  assert.equal(ledLook(m,`${a}:shelf-light:2`).tone,3000);assert.equal(ledLook(m,`${a}:light:left`).tone,6000);
  // тип меняет сечение (условная геометрия), длина та же
  const st=parts(m).find(p=>p.id===`${a}:light:left`)!;assert.equal(st.size[0],RULES.lightSurfaceT);assert.equal(st.size[2],RULES.lightSurfaceW);
  // сохранение и загрузка
  const loaded=parseProject(JSON.parse(JSON.stringify(project(m)))).modules[0].module;
  assert.equal(loaded.lightTone,6000);assert.equal(loaded.lightType,'surface');assert.deepEqual(loaded.sections[0].lightSpec,{'shelf:2':{tone:3000}});
  // мусор в файле отсекается: неверный тон, место без подсветки, несуществующая полка
  const raw=JSON.parse(JSON.stringify(m));raw.lightTone=5000;raw.sections[0].lightSpec={'shelf:2':{tone:3000,type:'neon'},'right':{tone:3000},'shelf:9':{tone:6000}};
  const clean=parseModule(raw);assert.equal(clean.lightTone,undefined);assert.deepEqual(clean.sections[0].lightSpec,{'shelf:2':{tone:3000}});
  // удаление полки: её выбор уходит, выбор полки выше сдвигается с ней
  const p=project(m),mid=p.modules[0].id;
  const n=removePart(p,mid,a,`${a}:shelf:0`).modules[0].module;assert.deepEqual(n.sections[0].lightSpec,{'shelf:1':{tone:3000}});assert.deepEqual(n.sections[0].shelfLights,[1]);
  const ins=insertItem(p,'shelf',mid,a,b0.bottom+0.1*(b0.top-b0.bottom)).modules[0].module.sections[0];
  assert.deepEqual(ins.lightSpec,{'shelf:3':{tone:3000}},'новая полка ниже — выбор едет за своей полкой');
  // «убрать» снимает деталь и её выбор; снова поставленная — с тоном модуля
  setLight(m,`${a}:shelf:2`,false);assert.equal(m.sections[0].lightSpec,undefined);setLight(m,`${a}:shelf:2`,true);assert.equal(ledLook(m,`${a}:shelf-light:2`).tone,6000);
  // «на весь модуль» — снимает свой выбор деталей по этому параметру
  setDetailSpec(m,`${a}:stand:left`,{tone:3000,type:'tape'});applyToAll(m,{tone:4000});
  assert.deepEqual(m.sections[0].lightSpec,{left:{type:'tape'}});assert.equal(m.lightTone,4000);
  setDetailSpec(m,`${a}:stand:left`,{type:null});assert.equal(m.sections[0].lightSpec,undefined,'«как у модуля» — свой выбор снят');
  assert.throws(()=>setDetailSpec(m,`${b}:stand:left`,{tone:3000}),/не подсвечена/);
  clearLights(m);assert.deepEqual(lightKeys(m),[]);assert.ok(m.sections.every(s=>!s.lightSpec));
});

test('задача 14: смета — старый проект без выбора тона/типа считается как раньше; выбранные тип и тон — описанием строки, цена та же',()=>{
  const m=wardrobe(),[a]=m.sections.map(s=>s.id);toggleDetailLight(m,'left');toggleDetailLight(m,`${a}:shelf:0`);toggleDetailLight(m,'top');
  const old=lightLines(project(m)),eOld=estimate(project(m));
  assert.deepEqual(old.map(l=>l.id).sort(),['light-roof','light-shelf','light-stand']);
  assert.equal(old.find(l=>l.id==='light-stand')!.name,'Подсветка врезная в стойках');
  // тот же модуль после файла — та же смета
  const re=parseProject(JSON.parse(JSON.stringify(project(m))));assert.deepEqual(lightLines(re),old);assert.equal(estimate(re).retail,eOld.retail);
  // выбор модуля: тёплый, накладной — описания в названиях, количество и цена те же
  const t=structuredClone(m);setModuleLight(t,{tone:3000,type:'surface'});
  const lt=lightLines(project(t));
  assert.deepEqual(lt.map(l=>l.name).sort(),['Подсветка в крыше · накладной профиль, тёплый 3000K','Подсветка в полках · накладной профиль, тёплый 3000K','Подсветка в стойках · накладной профиль, тёплый 3000K']);
  assert.deepEqual(lt.map(l=>[l.q,l.price]).sort(),old.map(l=>[l.q,l.price]).sort());
  assert.equal(estimate(project(t)).retail,eOld.retail,'итог тот же');
  // у одной полки свой тон — своя строка, сумма та же
  setDetailSpec(t,`${a}:shelf:0`,{tone:6000});
  const l2=lightLines(project(t));assert.ok(l2.some(l=>l.id==='light-shelf:surface:6000'&&/холодный 6000K/.test(l.name)));assert.equal(estimate(project(t)).retail,eOld.retail);
  // КП: в скобках, только при выборе
  assert.ok(describeModule(m).filling.every(f=>!f.includes('(')||!f.startsWith('подсветка')),describeModule(m).filling.join(' | '));
  const f=describeModule(t).filling.join(' | ');assert.match(f,/подсветка в стойках: 1 шт\., [\d,]+ пог\. м \(накладной профиль, тёплый 3000K\)/);
  assert.match(f,/подсветка в полках и под крышей: 3 шт\., [\d,]+ пог\. м \(накладной профиль, (холодный 6000K; накладной профиль, тёплый 3000K|тёплый 3000K; накладной профиль, холодный 6000K)\)/);
  assert.equal(lightSummary(m).vertical.spec,'');
});

test('задача 14: меню «Подсветка › Настроить…» открывает окно подсветки',()=>{
  const m=wardrobe();let opened=0;
  const ops:QuickMenuOps={modify:()=>{},addUpper:()=>{},lightMode:()=>{},lightPanel:()=>{opened++;}};
  const it=lightItem(m,m.sections[0].id,ops).children!.find(c=>c.id==='q-light-setup')!;
  assert.equal(it.label,'Настроить…');assert.ok(!it.disabled);it.run!();assert.equal(opened,1);
  assert.ok(lightItem(m,m.sections[0].id,{...ops,lightPanel:undefined}).children!.find(c=>c.id==='q-light-setup')!.disabled);
});
