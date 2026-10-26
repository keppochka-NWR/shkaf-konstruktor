// Заказ 7442203 (угловой шкаф и пенал 2620): что дописано в студии и проверяется здесь —
// 1) высота шкафа без задника / с задником ЛДСП до листа ЛДСП (2730), с ЛХДФ — прежние 2500;
// 2) проём между рядами фасадов у шкафа (doorSplit + doorNiche): ящики в проёме — накладные фасады вровень с дверями, нижний ряд не тянется;
// 3) петли 155–165° (wideHinges), подсветка по датчику движения (lightSensor), торцевые ручки 350/500/600 — позиции «после финального расчёта»;
// 4) без дна на цоколе — опор нет (боковины на полу); 5) проект заказа: 0 ошибок, 0 пересечений, цена есть.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,parts,validate,maxHeightOf,kupeBodyMax,RULES,legCount,parseModule,allHingeAngles,type Module} from '../src/model';
import {newProject,projectErrors,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {partCollisions} from '../src/collisions';
import {HANDLES} from '../src/handles';
import {moduleQuote} from '../src/itemPrices';
import {build,CORNER_IDS,PENCIL_IDS} from '../scripts/order-7442203';

const base=(p:Partial<Module>={}):Module=>({...initialModule(),name:'Шкаф',width:500,height:2000,depth:582,doors:true,sections:[section()],...p});
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.room={...p.room,width:3000,depth:2400,height:2800};p.modules=ms.map((m,i)=>({id:id(),x:100+i*700,y:0,z:10,rotation:0,module:m}));return p;}

test('высота: без задника и с задником ЛДСП — до 2730 по листу 2750, с ЛХДФ — 2500', () => {
  assert.equal(maxHeightOf(base({backType:'none'})),kupeBodyMax());
  assert.equal(maxHeightOf(base({backType:'board'})),kupeBodyMax());
  assert.equal(maxHeightOf(base()),RULES.maxH);
  assert.equal(maxHeightOf(base({backType:'groove'})),RULES.maxH);
  assert.deepEqual(validate(base({backType:'none',height:2620})),[]);
  assert.deepEqual(validate(base({backType:'board',height:2620,width:430,depth:322})),[]);
  const e=validate(base({height:2620}));
  assert.match(e[0],/до 2500 мм\. Выше 2500 — без задней стенки или с задником ЛДСП/);
  assert.match(validate(base({backType:'none',height:2740}))[0],/до 2730/);
  // боковины и задник ЛДСП 2620 — цельные детали из листа 2750
  const ps=parts(base({backType:'board',height:2620}));
  assert.equal(ps.find(p=>p.id==='left')!.size[1],2620);
  assert.ok(ps.find(p=>p.id==='back')!.size[1]<=kupeBodyMax());
});

test('проём между рядами фасадов: ящики в проёме — накладные фасады вровень с дверями', () => {
  const m=base({width:430,height:2620,depth:322,backType:'board',bottomType:'none',plinthHeight:60});
  m.sections[0]={...section(),doorSplit:619,doorNiche:624,drawers:2,drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'dtc',height:140,length:270,y:589,facadeH:198},{slide:'gtv0fpo',operation:'soft-close',brand:'dtc',height:140,length:270,y:791,facadeH:198}]};
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),doors=ps.filter(p=>p.role==='door'),fronts=ps.filter(p=>p.id.endsWith(':facade'));
  assert.equal(doors.length,2);
  const [lo,hi]=doors.sort((a,b)=>a.position[1]-b.position[1]).map(d=>[d.position[1]-d.size[1]/2,d.position[1]+d.size[1]/2]);
  assert.deepEqual(lo.map(Math.round),[30,648]);
  assert.deepEqual(hi.map(Math.round),[1272,2618]);
  // фасады ящиков в проёме 648–1272, на той же плоскости, что двери, и той же ширины
  for(const f of fronts){assert.ok(f.position[1]-f.size[1]/2>=648&&f.position[1]+f.size[1]/2<=1272);assert.equal(f.position[2],doors[0].position[2]);assert.equal(f.size[0],doors[0].size[0]);}
  assert.equal(ps.filter(p=>p.id.includes(':filler:')).length,0,'ящики не за дверью — фальши у петель не нужны');
  assert.deepEqual(partCollisions(ps,m).map(c=>c.names.join(' × ')),[]);
  // ящик, вылезающий из проёма, — понятная ошибка
  const bad=structuredClone(m);bad.sections[0].drawerConfigs![0].y=400;
  assert.ok(validate(bad).some(e=>/ящики в проёме между рядами фасадов/.test(e)));
  // у кухни ниша по-прежнему своя (doorNiche только с разделением)
  const noSplit=structuredClone(m);delete noSplit.sections[0].doorSplit;
  assert.ok(validate(noSplit).some(e=>/проём между рядами фасадов: только при разделённых фасадах/.test(e)));
});

test('петли 155–165°, датчик движения, торцевые ручки — строки сметы «после финального расчёта»', () => {
  // интеграция 26.10: «Петли 155–165°» модуля = угол 165 у всех створок (hingeAngles, o-7427796); wideHinges — синоним при загрузке
  const m=parseModule({...JSON.parse(JSON.stringify(base({lightSensor:true,handleId:'edge600b'}))),wideHinges:true});m.sections[0].standLights=['left'];
  assert.ok(allHingeAngles(m,165));
  const p=project(m),e=estimate(p),line=(id:string)=>e.lines.find(l=>l.id===id);
  assert.equal(line('hinge'),undefined);
  assert.ok(line('hinge-165')?.retail&&line('hinge-165')!.unitPrice===1700&&line('hinge-165')!.quantity>=4,'петля 155° — 1 700 ₽ клиенту (решение Макса 26.10)');
  assert.ok(line('light-sensor')?.pending&&line('light-psu')?.pending);
  assert.ok(line('handle:edge600b')?.pending);
  assert.equal(e.missing.length,0);
  assert.ok((e.byMarkup??0)>0);
  // без подсветки датчика нет; без флага — обычные петли
  const plain=base({lightSensor:true});const e2=estimate(project(plain));
  assert.equal(e2.lines.find(l=>l.id==='light-sensor'),undefined);
  assert.ok(e2.lines.find(l=>l.id==='hinge'));
  // флаги переживают сохранение
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.ok(allHingeAngles(back,165));assert.equal(back.lightSensor,true);
  for(const id of ['edge350b','edge500b','edge600b'])assert.ok(HANDLES.find(h=>h.id===id)?.pending);
});

test('без дна на цоколе: боковины на полу, опор нет; с дном — как было', () => {
  assert.equal(legCount(base({bottomType:'none',plinthHeight:60})),0);
  assert.equal(legCount(base({plinthHeight:60})),RULES.legsPerModule);
  const ps=parts(base({bottomType:'none',plinthHeight:60}));
  assert.equal(ps.find(p=>p.id==='left')!.position[1]-ps.find(p=>p.id==='left')!.size[1]/2,0);
  assert.equal(ps.some(p=>p.id==='bottom'),false);
});

test('проект заказа 7442203: 0 ошибок, 0 пересечений, размеры по эскизу, цена по изделиям', () => {
  const p=build();
  assert.deepEqual(projectErrors(p),[]);
  for(const a of p.modules){assert.deepEqual(validate(a.module),[],a.module.name);const ps=parts(a.module);assert.deepEqual(partCollisions(ps,a.module).map(c=>c.names.join(' × ')),[],a.module.name);}
  const wing=p.modules.filter(a=>a.module.name.includes('правое крыло'));
  assert.equal(wing.length,2);
  // решение Макса 26.10 «подгонять под эскиз всё»: крыло 470 без угловой планки, левый 500 без ФП к стене (отклонение флагом autoFillersOff)
  for(const a of wing){assert.equal(a.module.cornerFiller,undefined);assert.equal(a.module.width,470);}
  const left=p.modules.find(a=>a.module.name==='Угловой шкаф · левый')!.module;assert.equal(left.width,500);assert.equal(left.autoFillersOff,true);assert.equal(left.wallFiller,undefined);
  const t=estimate(p);
  assert.equal(t.missing.length,0);
  assert.ok((t.retail??0)>0);
  // цена по изделиям — доли итога (как «Цены по изделиям» в КП): сумма долей = итог
  const q=moduleQuote(p,t.retail)!,share=(ids:string[])=>p.modules.reduce((s,a,i)=>s+(ids.includes(a.id)?q.prices[i]:0),0);
  assert.ok(share(CORNER_IDS)>0&&share(PENCIL_IDS)>0);
  assert.equal(share(CORNER_IDS)+share(PENCIL_IDS),t.retail);
  assert.equal(p.modules.find(a=>a.module.name==='Пенал в нишу')!.module.height,2620);
});
