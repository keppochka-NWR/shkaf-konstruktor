// Свободная панель из МДФ «Вернисаж» (28.10.2026): накладная видимая боковина пенала в эмали, щит у барной стойки, задняя стенка
// витрины. Не раскрой ЛДСП и без кромки ЛДСП; в смете — строкой Вернисажа по vernissageFacadePrice (одна панель = один фасад).
import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,validate} from '../src/model';
import {newProject,parseProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {details} from '../src/exports';
import {freePanel,type FreePanelInput} from '../src/freePanels';
import {vernissageFacadePrice,vernissageSizeCheck,VERNISSAGE_MILLINGS,type VernissageFacade} from '../src/facadesVernissage';

const ENAMEL:VernissageFacade={milling:'1',cover:'enamel-matte',enamelColor:'RAL 9003',thickness:19};
const base:FreePanelInput={name:'Боковина пенала',width:600,height:2100,thickness:16,plane:'yz',edge:0.4,decor:'Белый'};
const project=(a:ReturnType<typeof freePanel>):Project=>({...newProject(),modules:[{...a,x:100,z:100}]});

test('МДФ Вернисаж: модуль с выбором Вернисажа, деталь вне раскроя и без кромки; толщина — по МДФ',()=>{
  const a=freePanel({...base,vernissage:ENAMEL}),m=a.module,p=m.raw!.panels[0];
  assert.equal(m.vernissage!.milling,'1');assert.equal(m.vernissage!.cover,'enamel-matte');
  assert.equal(p.fm,true);assert.equal(p.kind,'mdf');assert.equal(p.edges,undefined,'кромки ЛДСП нет');assert.equal(p.thick,19);
  assert.deepEqual([m.width,m.height,m.depth],[19,2100,600],'боковая панель: толщина МДФ по X');
  const d=parts(m).find(q=>q.id==='raw:p0')!;
  assert.equal(d.external,true);assert.equal(d.vernissage,true);assert.deepEqual(d.edge,[0,0,0,0]);assert.match(d.name,/МДФ Вернисаж №1/);
  assert.deepEqual(validate(m),[]);
  assert.equal(details(project(a)).length,0,'нет деталей в раскрое ЛДСП');
});

test('смета: строка Вернисажа по площади панели (vernissageFacadePrice), без листов и кромки ЛДСП, коэффициент Вернисажа',()=>{
  const a=freePanel({...base,vernissage:ENAMEL}),e=estimate(project(a));
  const v=e.lines.filter(l=>l.id.startsWith('vernissage-panel:'));
  assert.equal(v.length,1);
  const pr=vernissageFacadePrice(a.module.vernissage!,600,2100);
  assert.equal(v[0].quantity,Math.round(pr.billArea*1e4)/1e4);assert.equal(v[0].quantity,1.26);
  assert.equal(v[0].unitPrice,pr.perM2);assert.ok(pr.perM2&&pr.perM2>0,'цена из прайса');
  assert.match(v[0].label,/Панели МДФ Вернисаж .*№1.*эмаль мат RAL 9003.*МДФ 19/);assert.match(v[0].source,/коэффициент Вернисажа/);
  assert.equal(e.lines.some(l=>l.id.startsWith('sheet:')),false,'листов ЛДСП нет');
  assert.equal(e.lines.some(l=>/^edge\d/.test(l.id)&&l.quantity>0),false,'кромки ЛДСП нет');
  assert.equal(e.lines.some(l=>l.id==='facade-external'),false,'не «фасадный материал без цены»');
  // маленькая фронтальная панель в плёнке ПВХ: меньше 0,3 м² — как 0,3 (как фасад)
  const small=freePanel({...base,plane:'xy',width:400,height:500,vernissage:{milling:'1',cover:'film',film:'Моно белый',thickness:19}});
  const s=estimate(project(small)).lines.find(l=>l.id.startsWith('vernissage-panel:'))!;
  assert.equal(s.quantity,0.3);
});

test('сохранение и загрузка: Вернисаж и пометка фасадного материала сохраняются',()=>{
  const p=project(freePanel({...base,plane:'xy',vernissage:{...ENAMEL,patina:true}}));
  const back=parseProject(JSON.parse(JSON.stringify(p))).modules[0].module;
  assert.deepEqual(back.vernissage,p.modules[0].module.vernissage);
  assert.equal(back.raw!.panels[0].fm,true);assert.equal(back.raw!.source,'garderyob-free-panel');
  assert.deepEqual(estimate(parseProject(JSON.parse(JSON.stringify(p)))).lines.map(l=>[l.id,l.quantity]),estimate(p).lines.map(l=>[l.id,l.quantity]));
});

test('обычная панель ЛДСП не изменилась: раскрой, кромка, без Вернисажа',()=>{
  const a=freePanel(base),m=a.module,p=m.raw!.panels[0];
  assert.equal(m.vernissage,undefined);assert.equal(p.kind,'ldsp');assert.equal(p.fm,undefined);assert.equal(p.thick,16);
  assert.equal(p.edges!.length,4);assert.ok(p.edges!.every(e=>e[0]===0.4));
  const d=parts(m).find(q=>q.id==='raw:p0')!;assert.equal(d.external,undefined);assert.equal(d.vernissage,undefined);
  const e=estimate(project(a));
  assert.ok(e.lines.some(l=>l.id.startsWith('sheet:')&&l.quantity>0),'лист ЛДСП в смете');
  assert.equal(e.lines.some(l=>l.id.startsWith('vernissage')),false);
  assert.equal(details(project(a)).length,1);
});

test('размер вне паспорта фрезеровки — ошибка проверки панели',()=>{
  // фрезеровка с паспортом PDF, для которой лицо 1500×2900 — не по паспорту (как у фасада: model.ts vernissageSizeCheck)
  const mill=VERNISSAGE_MILLINGS.find(x=>x.pp&&vernissageSizeCheck(x.id,undefined,1500,2900).errors.length)!;
  assert.ok(mill,'есть фрезеровка с пределами паспорта');
  const big=freePanel({...base,plane:'xy',width:1500,height:2900,vernissage:{milling:mill.id,cover:'film',film:'Моно белый',thickness:19}});
  const err=validate(big.module);
  assert.ok(err.length>0&&err.every(x=>/^Панель МДФ Вернисаж .*по паспорту/.test(x)),err.join('; '));
  // боковая панель: лицо — глубина × высота (600 × 2100), а не толщина
  assert.deepEqual(validate(freePanel({...base,vernissage:{...ENAMEL,milling:mill.id}}).module).filter(x=>/толщ/.test(x)),[]);
});
