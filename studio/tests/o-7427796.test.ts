// Заказ 7427796 (26.10.2026): функции студии для прихожей с сиденьем — посадочное место 32 (две плиты 16 склейкой), задник ЛДСП только
// у ниши (backFrom), добор 32 сбоку (sidePanels.thick), зеркало на фасаде-основе (mirror), угол открывания петель по створке (hingeAngles),
// скрытые Blum TANDEM, кромка на клей PUR, ручка-кнопка. Цены без счёта — «после финального расчёта» (pendingPrices).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,parts,parseModule,validate,fastenerCounts,facadeBottom,facadeTop,type Module} from '../src/model';
import {newProject,parseProject,projectErrors,applyAutoFillers,sideExtension,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {partCollisions} from '../src/collisions';
import {handleById,handleKind} from '../src/handles';
import {SLIDE_SYSTEMS} from '../src/hardware';
import {build} from '../scripts/order-7427796';

const mod=(patch:Partial<Module>,s:Partial<Module['sections'][number]>={}):Module=>{const m={...initialModule(),width:700,height:2000,depth:600,...patch};m.sections=[{...section(),shelves:[],...s}];return m;};
const proj=(m:Module,calc?:Project['calculation']):Project=>({...newProject(m),...(calc?{calculation:calc}:{})});
const line=(p:Project,id:string)=>estimate(p).lines.find(l=>l.id===id);

test('посадочное место 32: две плиты, нижняя без кромки и полкодержателей, склейка 1000 ₽/м²', () => {
  const m=mod({doors:false,plinthHeight:0},{shelves:[0.2],fixed:[0],thickShelves:[0]});
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),sid=m.sections[0].id,up=ps.find(p=>p.id===`${sid}:shelf:0`)!,low=ps.find(p=>p.id===`${sid}:shelf:0:glue`)!;
  assert.ok(up&&low);
  assert.equal(up.position[1]-low.position[1],16);
  assert.deepEqual(low.edge,[0,0,0,0]);
  assert.equal(fastenerCounts(m).shelfHolders,0);
  assert.deepEqual(partCollisions(ps,m),[]);
  const g=line(proj(m),'glue32')!;
  assert.equal(g.unitPrice,1000);assert.equal(g.retail,true);
  assert.equal(g.quantity,Math.round(low.length*low.width/1e3)/1e3);
  // только жёсткая полка
  assert.ok(validate(mod({doors:false},{shelves:[0.2],thickShelves:[0]})).some(e=>e.includes('посадочное место 32')));
});
test('посадочное место прямо над ящиком без полки над ящиками (drawerCap: нет)', () => {
  const at=(c:number)=>(c-16)/1968;
  const m=mod({doors:false,plinthHeight:0},{shelves:[at(442)],fixed:[0],thickShelves:[0],drawerCap:false,drawers:1,drawerMount:'inset',
    drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'blum',height:140,facadeH:196,length:550,handle:false,y:202}]});
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(partCollisions(parts(m),m),[]);
  // ящик заходит под сиденье — ошибка
  const bad=structuredClone(m);bad.sections[0].drawerConfigs![0].y=230;
  assert.ok(validate(bad).length>0);
});
test('задник ЛДСП только у ниши: от backFrom до крыши; только у задника ЛДСП', () => {
  const m=mod({doors:false,plinthHeight:0,backType:'board',backFrom:450});
  const b=parts(m).find(p=>p.id==='back')!;
  assert.equal(Math.round(b.position[1]-b.size[1]/2),450);
  assert.equal(Math.round(b.position[1]+b.size[1]/2),1984);
  assert.ok(validate({...m,backType:'nailed'}).some(e=>e.includes('Задник ЛДСП от высоты')));
  assert.deepEqual(validate(m),[]);
});
test('добор 32: две плиты в цвет корпуса, вылет 32, у стены без планки торцом', () => {
  const m=mod({width:600,sidePanels:{right:{height:2450,depth:618,thick:32}}},{doorLeaves:1});
  const ps=parts(m),a=ps.find(p=>p.id==='side-panel:right')!,b=ps.find(p=>p.id==='side-panel:right:glue')!;
  assert.equal(b.position[0]-a.position[0],16);assert.equal(a.decor,m.decor);assert.equal(b.decor,m.decor);
  assert.equal(sideExtension(m,'right'),32);
  const p:Project={...newProject(m),room:{width:632,depth:2000,height:2700,openings:[]}};p.modules[0].x=0;p.modules[0].z=3;
  const n=applyAutoFillers(p);
  assert.equal(n.modules[0].module.wallFiller,undefined);
  assert.equal(n.modules[0].x,0);
  assert.ok(line(n,'glue32')!.quantity>1.4);
});
test('зеркало на фасаде: признак двери, строки зеркала, плёнки, полировки; наклейка — финальный расчёт', () => {
  const m=mod({width:600,mirror:'mirror-silver',hingeBrand:'blum'},{doorLeaves:1});
  assert.deepEqual(validate(m),[]);
  const door=parts(m).find(p=>p.role==='door')!;
  assert.equal(door.mirror,'mirror-silver');assert.equal(door.material,'board');
  const p=proj(m),area=door.size[0]*door.size[1]/1e6;
  assert.equal(line(p,'glass-mirror:mirror-silver')!.unitPrice,1530);
  assert.ok(Math.abs(line(p,'glass-mirror:mirror-silver')!.quantity-area)<0.001);
  assert.equal(line(p,'glass-mirror-film')!.unitPrice,90);
  assert.equal(line(p,'glass-mirror-polish')!.unitPrice,100);
  assert.equal(line(p,'glass-mirror-glue')!.pending,true);
  assert.ok(estimate(p).byMarkup!>estimate(proj({...m,mirror:undefined})).byMarkup!);
  assert.ok(validate({...m,doors:false}).some(e=>e.includes('Зеркало на фасадах')));
  assert.ok(validate({...m,mirror:'glass-clear'}).some(e=>e.includes('Зеркало на фасадах')));
});
test('угол открывания петель по створке: признак двери и строки «после финального расчёта»', () => {
  const m=mod({height:450,plinthHeight:0,hingeBrand:'blum'},{doorLeaves:2,hingeAngles:[null,165]});
  const ds=parts(m).filter(p=>p.role==='door');
  assert.equal(ds.find(d=>d.id.endsWith(':door:1'))!.hingeAngle,165);
  assert.equal(ds.find(d=>d.id.endsWith(':door:0'))!.hingeAngle,undefined);
  const p=proj(m);
  // решение Макса 26.10.2026: петля 155° — 1 700 ₽, петля Blum 110° — 800 ₽ клиенту (розница)
  assert.equal(line(p,'hinge-165:blum')!.quantity,2);assert.equal(line(p,'hinge-165:blum')!.unitPrice,1700);assert.equal(line(p,'hinge-165:blum')!.retail,true);assert.equal(line(p,'hinge:blum')!.unitPrice,800);
  const p90=proj(mod({height:450,plinthHeight:0,hingeBrand:'blum'},{doorLeaves:2,hingeAngles:[90,null]}));
  assert.equal(line(p90,'hinge:blum')!.quantity,4);assert.equal(line(p90,'hinge-limiter-90:blum')!.quantity,2);assert.equal(line(p90,'hinge-limiter-90:blum')!.unitPrice,50);
  assert.equal(line(p,'hinge:blum')!.quantity,2);
  assert.ok(validate(mod({},{hingeAngles:[120 as never]})).some(e=>e.includes('угол открывания')));
});
test('Blum TANDEM 10 000 ₽ клиенту; кромки PUR нет (решение Макса 26.10 — старое поле игнорируется); ручка-кнопка в каталоге', () => {
  assert.ok(SLIDE_SYSTEMS.some(s=>s.id==='hidden-blum-soft'));
  const m=mod({doors:false},{drawers:1,drawerConfigs:[{slide:'gtv0fpo',operation:'soft-close',brand:'blum',height:140,length:500}]});
  const raw=JSON.parse(JSON.stringify(proj(m,{markup:2.2,overrides:{}})));raw.calculation.edgeGlue='pur'; // проект ветки o-7427796
  const p=parseProject(raw),e=estimate(p);
  const sl=e.lines.find(l=>l.id.startsWith('slide:gtv0fpo:500:hidden-blum-soft'))!;
  assert.equal(sl.unitPrice,10000);assert.equal(sl.retail,true);
  assert.equal(e.lines.some(l=>/pur/i.test(l.id+l.label)),false,'строки PUR в смете нет');
  assert.equal(e.missing.length,0);
  assert.equal((p.calculation as Record<string,unknown>).edgeGlue,undefined,'поле PUR при загрузке отброшено');
  const k=handleById('knob30b');assert.equal(k.id,'knob30b');assert.equal(handleKind(k),'knob');
});
test('разбор проекта: новые поля сохраняются, старые модули без новых полей', () => {
  const m=parseModule(JSON.parse(JSON.stringify(mod({doors:false,plinthHeight:0,backType:'board',backFrom:450,sidePanels:{left:{height:2400,depth:600,thick:32}}},{shelves:[0.3],fixed:[0],thickShelves:[0],hingeAngles:[90]}))));
  assert.equal(m.backFrom,450);assert.equal(m.sidePanels!.left!.thick,32);assert.deepEqual(m.sections[0].thickShelves,[0]);assert.deepEqual(m.sections[0].hingeAngles,[90]);
  const old=parseModule(JSON.parse(JSON.stringify(mod({}))));
  for(const k of ['backFrom','mirror'] as const)assert.equal(k in old,false);
  assert.equal('thickShelves' in old.sections[0],false);
});
test('заказ 7427796: оба варианта собираются функциями студии — 0 ошибок, 0 пересечений, зеркальный дороже на строки зеркала', () => {
  const a=build(false),b=build(true);
  for(const p of [a,b]){assert.deepEqual(projectErrors(p),[]);for(const x of p.modules)assert.deepEqual(partCollisions(parts(x.module),x.module),[],x.module.name);}
  const ea=estimate(a),eb=estimate(b);
  assert.equal(ea.missing.length,0);assert.equal(eb.missing.length,0);
  const mirrorCost=eb.lines.filter(l=>l.id.startsWith('glass-mirror')).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);
  assert.ok(Math.abs((eb.byMarkup!-ea.byMarkup!)-mirrorCost*2.2)<=100);
  // габарит: 1334 по ширине (с добором 32), 2450 по высоте
  const xs=b.modules.map(x=>[x.x,x.x+x.module.width+sideExtension(x.module,'right')]).flat();
  assert.equal(Math.max(...xs)-Math.min(...xs),1334);
  assert.equal(Math.max(...b.modules.map(x=>(x.y??0)+x.module.height)),2450);
});

test('цена по большей модели: max(коэффициент; лист + стекло/зеркало), по умолчанию выключена', () => {
  const m=mod({width:600,mirror:'mirror-silver'},{doorLeaves:1});
  const base=proj(m,{markup:2.2,overrides:{},sheetPrice:23000}),e0=estimate(base);
  assert.equal(e0.maxModel,false);assert.equal(e0.retail,e0.byMarkup);
  // интеграция 26.10: одно поле calculation.maxModel (ef9811a) — зеркало/стекло × коэффициент в «цене за лист» (offSheet, без округления до 100)
  const e=estimate(proj(m,{markup:2.2,overrides:{},sheetPrice:23000,maxModel:true}));
  const glass=e.lines.filter(l=>l.id.startsWith('glass-')&&!l.retail).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);
  assert.equal(e.offSheet,Math.round(glass*2.2));
  assert.equal(e.retail,Math.max(e.byMarkup!,e.bySheet));
  // старое поле ветки o-7427796 (calculation.priceMax) читается при загрузке как maxModel
  const old=JSON.parse(JSON.stringify(proj(m,{markup:2.2,overrides:{}})));old.calculation.priceMax=true;
  assert.equal(parseProject(old).calculation!.maxModel,true);
});
test('фасады по эскизу: свои низ и верх, карниз вплотную к верху, проверка зазора до карниза', () => {
  const m=mod({width:586,plinthHeight:80,facadeFrom:78,facadeTo:1998},{doorLeaves:1});
  assert.deepEqual(validate(m),[]);
  const d=parts(m).find(p=>p.role==='door')!;
  assert.equal(d.size[1],1920);assert.equal(facadeBottom(m),78);assert.equal(facadeTop(m),1998);
  const a=mod({width:586,height:450,plinthHeight:0,topStrip:78,facadeFrom:0,facadeTo:370},{doorLeaves:1});
  assert.deepEqual(validate(a),[]);
  const s=parts(a).find(p=>p.id==='top-strip')!;
  assert.equal(s.position[1]+s.size[1]/2,450);assert.equal(parts(a).find(p=>p.role==='door')!.size[1],370);
  assert.ok(validate({...a,topStrip:80}).some(e=>e.includes('заходит на планку')));
  assert.ok(validate({...m,facadeTo:300}).some(e=>e.includes('Фасады по эскизу')));
  // без полей — как раньше
  const old=mod({width:586,plinthHeight:80},{doorLeaves:1});
  assert.equal(parts(old).find(p=>p.role==='door')!.size[1],2000-2-30);
});