// Подсветка по деталям (запрос Макса 20.10.2026): «выбор левой, правой или обеих стоек, по полкам тоже выбор; режим — кликаешь
// детали, в которых заложить подсветку». Миграция старых флагов, переключение по деталям, цены 3000/4000, сохранение и загрузка.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,boxes,parts,parseModule,RULES,type Module} from '../src/model';
import {newProject,parseProject,type Project} from '../src/project';
import {removePart,insertItem} from '../src/operations';
import {estimate} from '../src/pricing';
import {lightItem,type QuickMenuOps} from '../src/quickMenu';
import {lightKeys,lightTargets,toggleDetailLight,migrateLights,setStands,setSectionShelves,clearLights,allStandsLit,setAllStands,lightSummary} from '../src/lights';
import {describeModule} from '../src/quoteDescribe';
import {addMenuItem} from '../src/addMenu';
import type {RadialItem} from '../src/RadialMenu';

const wardrobe=():Module=>{const m:Module={...initialModule(),name:'Шкаф',width:1200,height:2400,depth:600,doors:true,sections:[section(),section()]};m.sections[0].shelves=[0.25,0.5,0.75];m.sections[1].shelves=[0.4,0.8];return m;};
function project(m:Module):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:200,y:0,z:200,rotation:0,module:m}];return p;}
const leds=(m:Module)=>parts(m).filter(p=>p.role==='light'&&!p.id.startsWith('groove:')).map(p=>({id:p.id,length:Math.round(p.length*10)/10,position:p.position.map(v=>Math.round(v*10)/10)})).sort((a,z)=>a.id.localeCompare(z.id));
const line=(m:Module,lid:string)=>estimate(project(m)).lines.find(l=>l.id===lid);
function spy(m:Module){let mod=structuredClone(m);let mode=0;
  const ops:QuickMenuOps={modify:u=>{const n=structuredClone(mod);u(n);mod=n;},addUpper:()=>{},lightMode:()=>{mode++;}};
  return {ops,get mod(){return mod;},get mode(){return mode;}};}

test('миграция: standLight → обе стойки каждой секции, shelfLight → все полки секции; те же LED-профили и та же смета',()=>{
  const old=wardrobe();old.standLight=true;old.sections[1].shelfLight=true;
  const before=leds(old),eOld=estimate(project(old));
  const m=parseModule(JSON.parse(JSON.stringify(old)));
  assert.equal('standLight' in m,false,'старого флага модуля нет');assert.ok(m.sections.every(s=>!('shelfLight' in s)),'старого флага секции нет');
  assert.deepEqual(m.sections.map(s=>s.standLights),[['left','right'],['left','right']]);
  assert.equal(m.sections[0].shelfLights,undefined);assert.deepEqual(m.sections[1].shelfLights,[0,1]);
  assert.deepEqual(leds(m),before,'набор LED-профилей тот же');
  const eNew=estimate(project(m));assert.equal(eNew.retail,eOld.retail);
  for(const lid of ['light-stand','light-shelf'])assert.equal(eNew.lines.find(l=>l.id===lid)!.quantity,eOld.lines.find(l=>l.id===lid)!.quantity);
  // проект целиком (сохранённый файл) — тоже мигрирует
  const p=project(old),loaded=parseProject(JSON.parse(JSON.stringify(p))).modules[0].module;
  assert.deepEqual(lightKeys(loaded),lightKeys(m));
  // без подсветки — ничего не добавляется
  const plain=parseModule(JSON.parse(JSON.stringify(wardrobe())));assert.deepEqual(lightKeys(plain),[]);assert.ok(plain.sections.every(s=>!s.standLights&&!s.shelfLights&&!s.topLight));
});

test('клик по деталям: левая боковина, правая боковина, перегородка (обе грани), полка, крыша; повторный клик снимает',()=>{
  const m=wardrobe(),[a,b]=m.sections.map(s=>s.id);
  assert.ok(toggleDetailLight(m,'left'));assert.deepEqual(lightKeys(m),[`${a}:stand:left`]);
  assert.ok(toggleDetailLight(m,'right'));assert.deepEqual(lightKeys(m),[`${a}:stand:left`,`${b}:stand:right`]);
  assert.deepEqual(lightTargets(m,`${b}:divider`),[`${a}:stand:right`,`${b}:stand:left`],'перегородка — грань в каждую секцию');
  toggleDetailLight(m,`${b}:divider`);assert.ok(lightKeys(m).includes(`${a}:stand:right`)&&lightKeys(m).includes(`${b}:stand:left`));
  toggleDetailLight(m,`${b}:divider`);assert.ok(!lightKeys(m).includes(`${a}:stand:right`)&&!lightKeys(m).includes(`${b}:stand:left`));
  toggleDetailLight(m,`${a}:shelf:1`);assert.deepEqual(m.sections[0].shelfLights,[1]);
  toggleDetailLight(m,'top');assert.ok(m.sections.every(s=>s.topLight===true),'крыша — над всеми секциями');
  // клик по самой LED-полосе снимает именно её
  assert.deepEqual(lightTargets(m,`${a}:light:left`),[`${a}:stand:left`]);toggleDetailLight(m,`${a}:light:left`);assert.ok(!lightKeys(m).includes(`${a}:stand:left`));
  toggleDetailLight(m,`${a}:shelf-light:1`);assert.equal(m.sections[0].shelfLights,undefined);
  toggleDetailLight(m,`${b}:light:roof`);assert.equal(m.sections[1].topLight,undefined);assert.equal(m.sections[0].topLight,true);
  // детали без подсветки: задник, дно, цоколь, фасад
  for(const pid of ['back','bottom',`${a}:door:0`])assert.equal(toggleDetailLight(m,pid),false,pid);
});

test('LED-профили по деталям: левая стойка — одна вертикаль на высоту секции, полка — по её длине, крыша — горизонталь',()=>{
  const m=wardrobe(),[a]=m.sections.map(s=>s.id),b0=boxes(m)[0];
  toggleDetailLight(m,'left');toggleDetailLight(m,`${a}:shelf:0`);toggleDetailLight(m,`${a}:shelf:2`);
  const l=parts(m).filter(p=>p.role==='light');
  assert.deepEqual(l.map(p=>p.id).sort(),[`${a}:light:left`,`${a}:shelf-light:0`,`${a}:shelf-light:2`].sort());
  const st=l.find(p=>p.id===`${a}:light:left`)!;assert.ok(Math.abs(st.length-(b0.top-b0.bottom))<0.01);assert.ok(st.position[0]<b0.x+RULES.lightProfileT,'у левой боковины');
  assert.ok(l.filter(p=>p.id.includes('shelf-light')).every(p=>Math.abs(p.length-(b0.width-40))<0.01));
  setStands(m,a,'right',true);toggleDetailLight(m,'top');
  const top=parts(m).find(p=>p.id===`${a}:light:roof`)!;assert.ok(top.size[0]>top.size[1],'горизонталь');assert.ok(Math.abs(top.position[1]+top.size[1]/2-b0.top)<0.01,'вплотную под крышей');
});

test('цены: вертикали 3000 ₽/пог.м, горизонтали (полки, крыша) 4000 ₽/пог.м, розница поверх коэффициента',()=>{
  const m=wardrobe(),[a]=m.sections.map(s=>s.id),b0=boxes(m)[0],e0=estimate(project(m));
  toggleDetailLight(m,'left');toggleDetailLight(m,`${a}:shelf:0`);toggleDetailLight(m,`${a}:shelf:1`);
  const stand=line(m,'light-stand')!,shelf=line(m,'light-shelf')!;
  assert.equal(stand.unitPrice,3000);assert.equal(stand.retail,true);assert.ok(Math.abs(stand.quantity-(b0.top-b0.bottom)/1000)<1e-6,'одна стойка — высота секции');
  assert.equal(shelf.unitPrice,4000);assert.equal(shelf.retail,true);assert.ok(Math.abs(shelf.quantity-2*(b0.width-40)/1000)<1e-6,'две полки');
  const e=estimate(project(m));assert.equal(e.retail,e0.retail!+Math.round(stand.quantity*3000+shelf.quantity*4000));
  assert.equal(e.knownCost,e0.knownCost,'себестоимость под коэффициент не меняется');
  toggleDetailLight(m,'top');const roof=line(m,'light-roof')!;
  assert.equal(roof.unitPrice,RULES.shelfLightRetailPerM);assert.ok(Math.abs(roof.quantity-boxes(m).reduce((s,b)=>s+b.width-40,0)/1000)<1e-6,'под крышей обеих секций');
  assert.equal(line(m,'light-stand')!.quantity,stand.quantity,'крыша не идёт по цене стоек');
});

test('удаление полки уносит её подсветку, номера соседей сдвигаются; новая полка подсветку соседней не забирает',()=>{
  const m=wardrobe(),[a]=m.sections.map(s=>s.id);setSectionShelves(m,a,false);m.sections[0].shelfLights=[0,2];
  const p=project(m),mid=p.modules[0].id;
  const n=removePart(p,mid,a,`${a}:shelf:0`).modules[0].module;
  assert.deepEqual(n.sections[0].shelves,[0.5,0.75]);assert.deepEqual(n.sections[0].shelfLights,[1],'светится бывшая полка 3 (0.75)');
  const n2=removePart(p,mid,a,`${a}:shelf:2`).modules[0].module;assert.deepEqual(n2.sections[0].shelfLights,[0]);
  const n3=removePart(p,mid,a,`${a}:shelf:1`).modules[0].module;assert.deepEqual(n3.sections[0].shelfLights,[0,1],'удалили неподсвеченную — подсветка на тех же полках');
  const b=boxes(m)[0],ins=insertItem(p,'shelf',mid,a,b.bottom+0.1*(b.top-b.bottom)).modules[0].module.sections[0];
  assert.equal(ins.shelves.length,4);assert.deepEqual(ins.shelfLights!.map(j=>ins.shelves[j]),[0.25,0.75],'подсветка осталась на тех же по высоте полках');
});

test('сохранение и загрузка: поштучная подсветка переживает файл проекта; мусор в файле отсекается',()=>{
  const m=wardrobe(),[a,b]=m.sections.map(s=>s.id);toggleDetailLight(m,'left');toggleDetailLight(m,`${b}:shelf:1`);toggleDetailLight(m,'top');
  const loaded=parseProject(JSON.parse(JSON.stringify(project(m)))).modules[0].module;
  assert.deepEqual(lightKeys(loaded),lightKeys(m));assert.deepEqual(leds(loaded),leds(m));
  const raw=JSON.parse(JSON.stringify(m));raw.sections[0].shelfLights=[0,0,7,'x'];raw.sections[0].standLights=['left','middle'];
  const clean=parseModule(raw);assert.deepEqual(clean.sections[0].shelfLights,[0]);assert.deepEqual(clean.sections[0].standLights,['left']);
  assert.ok(lightKeys(loaded).includes(`${a}:stand:left`));
});

test('меню «Подсветка ›»: левая/правая/обе стойки секции, все полки секции, режим выбора деталей, убрать всю подсветку',()=>{
  const m=wardrobe(),[a,b]=m.sections.map(s=>s.id),s=spy(m);
  const item=lightItem(s.mod,b,s.ops);
  assert.deepEqual(item.children!.map(c=>c.label),['Левая стойка','Правая стойка','Обе стойки','Все полки секции','Режим выбора деталей…','Убрать всю подсветку']);
  assert.ok(item.children![5].disabled,'снимать нечего');assert.match(item.children![0].hint!,/3\s000\s₽\sза\sпог\.\sм/);assert.match(item.children![3].hint!,/4\s000\s₽\sза\sпог\.\sм/);
  item.children![0].run!();assert.deepEqual(lightKeys(s.mod),[`${b}:stand:left`],'левая стойка секции 2 — перегородка со стороны секции 2');
  lightItem(s.mod,b,s.ops).children![2].run!();assert.deepEqual(lightKeys(s.mod),[`${b}:stand:left`,`${b}:stand:right`]);
  assert.ok(lightItem(s.mod,b,s.ops).children![2].active);
  lightItem(s.mod,b,s.ops).children![2].run!();assert.deepEqual(lightKeys(s.mod),[],'повторно «Обе стойки» — снять обе');
  lightItem(s.mod,a,s.ops).children![3].run!();assert.deepEqual(s.mod.sections[0].shelfLights,[0,1,2]);assert.ok(lightItem(s.mod,a,s.ops).children![3].active);
  lightItem(s.mod,a,s.ops).children![4].run!();assert.equal(s.mode,1,'режим выбора деталей включается');
  lightItem(s.mod,a,s.ops).children![5].run!();assert.deepEqual(lightKeys(s.mod),[]);
  assert.ok(lightItem(s.mod,a,{...s.ops,lightMode:undefined}).children![4].disabled);
  // старый проект с standLight: пункт показывает включённые стойки и снимает одну
  const old=wardrobe();old.standLight=true;const o=spy(old),[oa,ob]=old.sections.map(x=>x.id);
  assert.ok(lightItem(o.mod,oa,o.ops).children![0].active);lightItem(o.mod,oa,o.ops).children![0].run!();
  assert.equal('standLight' in o.mod,false);assert.deepEqual(lightKeys(o.mod),[`${oa}:stand:right`,`${ob}:stand:left`,`${ob}:stand:right`]);
});

test('«Подсветка в стойках» панели и «Улучшения › Подсветку»: все стойки; КП — вертикали и горизонтали с длинами',()=>{
  const m=wardrobe();assert.equal(allStandsLit(m),false);setAllStands(m,true);assert.ok(allStandsLit(m));assert.equal(lightKeys(m).length,4);
  const s=spy(wardrobe()),flat=(it:RadialItem):RadialItem[]=>[it,...(it.children??[]).flatMap(flat)];
  const add=addMenuItem(s.mod,s.mod.sections[0].id,{drop:()=>{},modify:s.ops.modify,split:()=>{},openKitchen:()=>{}});
  flat(add).find(c=>c.id==='add-light')!.run!();assert.ok(allStandsLit(s.mod));
  const k=wardrobe(),[a]=k.sections.map(x=>x.id);toggleDetailLight(k,'left');toggleDetailLight(k,`${a}:shelf:0`);toggleDetailLight(k,`${a}:shelf:1`);
  const sum=lightSummary(k),b0=boxes(k)[0];assert.equal(sum.vertical.count,1);assert.equal(sum.horizontal.count,2);
  const d=describeModule(k);
  assert.ok(d.filling.includes(`подсветка в стойках: 1 шт., ${(Math.round(b0.top-b0.bottom)/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})} пог. м`),d.filling.join(' | '));
  assert.ok(d.filling.some(f=>/^подсветка в полках: 2 шт\./.test(f)),d.filling.join(' | '));
  clearLights(k);assert.ok(!describeModule(k).filling.some(f=>f.startsWith('подсветка')));
  migrateLights(k);assert.deepEqual(lightKeys(k),[]);
});
