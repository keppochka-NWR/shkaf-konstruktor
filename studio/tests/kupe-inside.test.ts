// Задания менеджеров 22.10 (ветка claude/w-kupe): шкаф-купе с дверями внутри (11), полотно по секциям (23),
// реальная ширина полотна с нахлёстом и сверка с калькулятором купе web/calc (24).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {kupeLines,kupeErrors,kupeParts,kupeLeaf,kupeLeafWidth,kupeSectionFill,withSectionFill,kupeColor,DEFAULT_KUPE} from '../src/kupe';
import {KUPE_SYSTEMS} from '../src/kupeData';
import {createKupeModule,createKupeWardrobe} from '../src/ModulePalette';
import {initialModule,parts,validate,RULES} from '../src/model';
import {newProject,projectErrors,appendModuleGroup,parseProject,modulesOverlap} from '../src/project';
import {estimate} from '../src/pricing';
import {details} from '../src/exports';
import {partCollisions} from '../src/collisions';

/** Калькулятор купе (web/calc): прайс профилей и расчёт ширины полотна — тем же кодом, что в браузере. */
function calc(){
  const ctx:Record<string,unknown>={};vm.createContext(ctx);
  for(const f of ['../web/calc/data/profiles.js','../web/calc/js/kupe-door.js']){
    const code=readFileSync(new URL(f,import.meta.url.replace('/tests/','/')),'utf8').replace(/^﻿/,'').replace(/^(const|let|var) (\w+)/gm,'globalThis.$2');
    vm.runInContext(code,ctx,{filename:f});
  }
  return ctx as {PROFILE_SYSTEMS:{system:string;profile?:string}[];kupeDoorWidth:(W:number,N:number,p:string)=>{width:number;overlap:number};kupeSystemProfile:(s:{system:string;profile?:string})=>string};
}
const sum=(m:ReturnType<typeof createKupeModule>)=>kupeLines(m).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);

test('24: ширина полотна в студии = калькулятор купе для того же проёма — все системы, 1–7 дверей',()=>{
  const c=calc();let checked=0,same=0;
  for(const s of KUPE_SYSTEMS){
    // с 23.10 web/calc = калькулятор купе v2.10/2.11 (bake-calc-kupe.ts): все 17 систем студии, профиль — из прайса
    const cs=c.PROFILE_SYSTEMS.find(x=>x.system===s.system);if(cs){same++;assert.equal(c.kupeSystemProfile(cs),s.profile,'профиль системы '+s.system);}
    for(const W of [1200,2368,2400,3600])for(let N=1;N<=7;N++){
      const a=kupeLeafWidth(W,N,s),b=c.kupeDoorWidth(W,N,cs?c.kupeSystemProfile(cs):s.profile);
      assert.ok(Math.abs(a.width-b.width)<1e-9&&Math.abs(a.overlap-b.overlap)<1e-9,`${s.system} ${W}/${N}: студия ${a.width}, калькулятор ${b.width}`);checked++;
    }
  }
  assert.ok(checked>=17*28);assert.equal(same,17,'общие системы прайсов студии и web/calc');assert.equal(c.PROFILE_SYSTEMS.length,KUPE_SYSTEMS.length,'в web/calc нет систем сверх студии');
  // 2400 мм, 3 двери, Стандарт C: (2400 + 2 × 26,51) / 3 = 817,67 → 818 мм (а не W/N = 800)
  const m=createKupeModule(2400,2600,initialModule());m.kupe={...m.kupe!,doors:3};
  assert.equal(Math.round(kupeLeaf(m).width),818);
  // в 3D полотно той же ширины: от левой кромки ручки до правой
  const ps=kupeParts(m),l=ps.find(p=>p.id==='kupe:1:side:l')!,r=ps.find(p=>p.id==='kupe:1:side:r')!;
  assert.ok(Math.abs((r.position[0]+r.size[0]/2)-(l.position[0]-l.size[0]/2)-kupeLeaf(m).width)<1e-6);
  // цена по-прежнему от проёма (формула калькулятора W/N): контрольный пример не меняется
  const k=createKupeModule(1200,2000,initialModule());k.kupe={...DEFAULT_KUPE,system:'Стандарт (Аристо)',color:'Серебро матовое',fills:['Зеркало Серебро 4мм']};
  assert.equal(Math.round(sum(k)),24269);
});

test('23: полотно по секциям — 3D, смета по площади секций, проверка ЛДСП по секции, сохранение',()=>{
  const m=createKupeModule(2400,2600,initialModule());m.kupe={...m.kupe!,doors:3,sections:1,fills:['Зеркало Серебро 4мм']};
  const before=sum(m);
  m.kupe=withSectionFill(m.kupe,1,0,'Стекло сатин матовый 4мм');
  assert.deepEqual(m.kupe.sectionFills,[[],['Стекло сатин матовый 4мм',null],[]]);
  assert.equal(kupeSectionFill(m.kupe,1,0).n,'Стекло сатин матовый 4мм');assert.equal(kupeSectionFill(m.kupe,1,1).n,'Зеркало Серебро 4мм');
  assert.deepEqual(validate(m),[]);
  const ps=kupeParts(m);
  assert.equal(ps.find(p=>p.id==='kupe:1:fill:0:0')!.decor,'Стекло сатин матовый 4мм');
  assert.equal(ps.find(p=>p.id==='kupe:1:fill:1:0')!.decor,'Зеркало Серебро 4мм');
  assert.equal(ps.find(p=>p.id==='kupe:0:fill:0:0')!.decor,'Зеркало Серебро 4мм');
  // смета: сатин — половина одной двери (раскладка «2 равные»), зеркало — остальное
  const lines=kupeLines(m),area=2400/3/1000*2.6;
  const sat=lines.find(l=>l.id==='kupe-fill:Стекло сатин матовый 4мм')!,mir=lines.find(l=>l.id==='kupe-fill:Зеркало Серебро 4мм')!;
  assert.ok(Math.abs(sat.quantity-area/2)<1e-9&&Math.abs(mir.quantity-area*2.5)<1e-9);
  assert.notEqual(Math.round(sum(m)),Math.round(before));
  // то же наполнение, что у двери, не хранится; возврат секции к двери убирает запись целиком
  assert.equal(withSectionFill(m.kupe,1,0,null).sectionFills,undefined);
  // ЛДСП одной секцией выше листа 2750 — ошибка (полотно 2900 одной секцией), секции ниже листа — нет
  const tall=createKupeModule(1600,2900,initialModule());tall.kupe={...tall.kupe!,fills:['Зеркало Серебро 4мм']};
  assert.ok(!kupeErrors(tall).some(e=>e.includes('листа')),'зеркало — не ЛДСП');
  tall.kupe=withSectionFill(tall.kupe!,0,0,'Белый');assert.ok(kupeErrors(tall).some(e=>e.includes('листа')));
  assert.ok(kupeErrors({...m,kupe:{...m.kupe,sectionFills:[['нет такого']]}}).some(e=>e.includes('секций')));
  // проект сохраняется и открывается с полотнами секций
  const p=newProject();p.room={...p.room,width:5000};p.modules[0].module=m;
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).modules[0].module.kupe!.sectionFills,m.kupe.sectionFills);
});

test('11: шкаф-купе с дверями внутри 2400×2600×600 — боковины до пола и крыша на всю глубину, дно/цоколь/секции за дверями',()=>{
  const g=createKupeWardrobe(2400,2600,600,initialModule(),undefined,'inside');
  assert.equal(g.length,2);
  const body=g.find(a=>!a.module.kupe)!,doors=g.find(a=>a.module.kupe)!,t=RULES.panel;
  assert.equal(body.module.kupeZone,100);assert.equal(body.module.depth,500);assert.equal(body.module.doors,false);
  assert.equal(doors.module.kupe!.mount,'inside');
  // проём дверей — между боковинами и под крышей, низ дверей от пола
  assert.equal(doors.x,body.x+t);assert.equal(doors.module.width,2400-2*t);assert.equal(doors.module.height,2600-t);
  assert.equal(doors.y,0);assert.equal(doors.z,body.z+500);
  const ps=parts(body.module),by=(id:string)=>ps.find(p=>p.id===id)!;
  for(const id of ['left','right']){const p=by(id);assert.equal(p.size[2],600,id+' на всю глубину');assert.equal(p.position[1]-p.size[1]/2,0,id+' до пола');}
  assert.equal(by('top').size[2],600,'крыша на всю глубину');
  for(const id of ['bottom','plinth'])assert.ok(by(id).position[2]+by(id).size[2]/2<=500+1e-6,id+' за дверями');
  assert.ok(ps.filter(p=>p.id.endsWith(':divider')).every(p=>p.position[2]+p.size[2]/2<=500),'перегородки за дверями');
  assert.ok(ps.filter(p=>p.role==='shelf').every(p=>p.position[2]+p.size[2]/2<=500),'полки за дверями');
  // двери купе — внутри зоны 100 мм и ничего корпуса не задевают
  const kp=kupeParts(doors.module).map(p=>({...p,position:[p.position[0]+doors.x-body.x,p.position[1],p.position[2]+doors.z-body.z] as [number,number,number],id:'door:'+p.id}));
  // только корпус × двери (посадки внутри самих дверей купе проверяет kupe.test.ts)
  const hits=partCollisions([...ps,...kp],body.module).filter(c=>c.a.startsWith('door:')!==c.b.startsWith('door:'));
  assert.deepEqual(hits.map(c=>c.names.join(' × ')),[]);
  assert.ok(!modulesOverlap(body,doors),'двери не пересекаются с корпусом');
  // проект: без ошибок, смета — двери купе своей графой, раскрой — боковины 2600×600
  const base=newProject();base.room={...base.room,width:5000,depth:3000,height:2700};
  const r=appendModuleGroup(base,g);assert.deepEqual(projectErrors(r.project),[]);
  const e=estimate(r.project);assert.ok(e.split.kupe>0);
  const d=details(r.project);assert.ok(d.some(x=>/Боковина/.test(x.name)&&x.length===2600&&x.width===600));
  assert.ok(!d.some(x=>/Направляющая|Профиль-ручка/.test(x.name)),'купе в раскрой не идёт');
  // сохранение
  const back=parseProject(JSON.parse(JSON.stringify(r.project)));
  assert.equal(back.modules.find(a=>a.module.kupeZone)!.module.kupeZone,100);
  assert.equal(back.modules.find(a=>a.module.kupe)!.module.kupe!.mount,'inside');
  // сверка с калькулятором: проём 2368 мм, 3 двери — ширина полотна та же
  const c=calc(),k=back.modules.find(a=>a.module.kupe)!.module;k.kupe={...k.kupe!,doors:3};
  assert.equal(Math.round(kupeLeaf(k).width),Math.round(c.kupeDoorWidth(2368,3,'C (классика)').width));
  assert.equal(Math.round(kupeLeaf(k).width),807);
});

test('22: все профили — рамки и разделители в пределах глубины ручки (SLIM, NOVA), «Золото кракелюр» — золото, не серая заглушка',()=>{
  for(const s of KUPE_SYSTEMS){
    const m=createKupeModule(1600,2400,initialModule());m.kupe={...m.kupe!,system:s.system,color:s.colors[0].name,sections:1};
    const ps=kupeParts(m),h=ps.find(p=>p.id==='kupe:0:side:l')!,z0=h.position[2]-h.size[2]/2,z1=h.position[2]+h.size[2]/2;
    for(const p of ps.filter(p=>/^kupe:0:(frame|div-)/.test(p.id)))if(p.size[2]<h.size[2])
      assert.ok(p.position[2]-p.size[2]/2>=z0-1e-6&&p.position[2]+p.size[2]/2<=z1+1e-6,`${s.system}: ${p.name} выступает из ручки`);
  }
  const slim=KUPE_SYSTEMS.find(s=>s.system==='Slim line (Аристо)')!;
  const m=createKupeModule(1600,2400,initialModule());m.kupe={...m.kupe!,system:slim.system,color:'Золото кракелюр'};
  assert.equal(kupeColor(m.kupe).grad,'#c0a030,#dcc048,#9a8020');
  assert.equal(kupeParts(m).find(p=>p.id==='kupe:0:side:l')!.look!.color,0xdcc048);
});

test('11: «отдельно» — как раньше; корпус с зоной дверей проверяет распашные фасады и предел листа',()=>{
  const g=createKupeWardrobe(1800,2400,600,initialModule());
  assert.ok(g.filter(a=>!a.module.kupe).every(a=>!a.module.kupeZone&&a.module.depth===500));
  assert.equal(g.find(a=>a.module.kupe)!.module.kupe!.mount,undefined);
  const body=createKupeWardrobe(2400,2600,600,initialModule(),undefined,'inside')[0].module;
  assert.ok(validate({...body,doors:true}).some(e=>e.includes('распашные')));
  assert.ok(validate({...body,width:2800}).some(e=>e.includes('Ширина')));
  assert.deepEqual(validate({...body,width:1200,height:2000,backType:'nailed'}),[]);
  assert.throws(()=>createKupeWardrobe(2400,2600,420,initialModule(),undefined,'inside'),/Глубина/);
});
