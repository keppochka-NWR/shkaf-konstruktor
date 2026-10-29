import test from 'node:test';
import assert from 'node:assert/strict';
import {aluFacadePrice,aluFill,ALU_FILLS,ALU_PROFILES,ALU_GASKET_PER_M,DEFAULT_ALU} from '../src/alu';
import {ALU_CALC_FILLS,ALU_CALC_PROFILES,ALU_CALC_SOURCE} from '../src/aluData';
import {hingeCount} from '../src/hardware';
import {ALU_CASES} from '../scripts/alu-compare';
import {parts,validate,isDrawerFront,aluDrawerFronts,aluDrawersAvailable,drawersBehindDoors,type Module} from '../src/model';
import {newProject,projectErrors,applyAutoFillers} from '../src/project';
import {estimate} from '../src/pricing';
import {partCollisions} from '../src/collisions';
import {kitchenProject} from '../src/kitchenProject';
import {applyFacadeStyle} from '../src/applyFacadeStyle';
import {facadeMaterialLabel,describeModule} from '../src/quoteDescribe';
import {setKitchenDrawerCount} from '../src/kitchenEditing';
import {changeFacadeKind} from '../src/facadeAppearance';

// Эталон — калькулятор фасадов ALU (calc-platform js/fasad-alu.js calcOneFasad, ветка calc-ready-1018): посчитан его же кодом
// (calcOneFasad, петли GTV стандарт, открывание влево). Цена фасада без петель = профиль + наполнение + уплотнитель.
test('5 эталонных случаев: цена фасада студии = калькулятор фасадов ALU',()=>{
  for(const c of ALU_CASES){
    const f=ALU_FILLS.find(x=>x.label===c.fill);assert.ok(f,c.fill+' есть в студии');
    const s=aluFacadePrice({profile:c.profile,color:'silver',insert:f!.id},c.w,c.h);
    assert.ok(Math.abs(s.total-c.calcNoHinge)<0.01,`${c.profile} ${c.w}×${c.h} ${c.fill}: студия ${s.total} ≠ калькулятор ${c.calcNoHinge}`);
    // в калькуляторе цена с петлями GTV стандарт 2/3 шт × 440 ₽; итог калькулятора — до рубля
    assert.equal(Math.round(c.calcNoHinge+c.calcHinges*440),c.calc);
  }
  // петли — НЕ как в калькуляторе (правило цеха hingeCount и строка фурнитуры студии): полная цена с петлями расходится намеренно
  assert.deepEqual(ALU_CASES.map(c=>hingeCount(c.h,c.w)),[2,4,6,3,3]);
  assert.deepEqual(ALU_CASES.map(c=>c.calcHinges),[2,3,3,2,2]);
});

test('данные рамки — из калькулятора: все профили и наполнения (включая узорчатые), цвет на цену не влияет',()=>{
  assert.deepEqual(ALU_PROFILES.map(p=>p.id),ALU_CALC_PROFILES.map(p=>p.id));
  assert.equal(ALU_FILLS.length,ALU_CALC_FILLS.length);
  assert.ok(ALU_FILLS.some(f=>f.group==='Узорчатые (склад)')&&ALU_FILLS.some(f=>f.group==='Узорчатые (заказные)'),'узорчатые стёкла калькулятора');
  // узорчатые группы — незакоммиченная правка FASAD_FILL_GROUPS калькулятора: импорт обязан это записать (ждёт решения Макса)
  assert.ok(ALU_CALC_SOURCE.commit,'коммит калькулятора записан');
  assert.ok(ALU_CALC_SOURCE.dirty.includes('calc-platform/data/fasad-alu-data.js'),'источник помечен как незакоммиченный — после коммита правки в калькуляторе переимпортировать и снять эту проверку');
  assert.equal(new Set(ALU_FILLS.map(f=>f.id)).size,ALU_FILLS.length,'id наполнений уникальны');
  for(const id of ['mirror-silver','glass-clear','satin','moru-bronze','satin-bronze'])assert.ok(aluFill(id),'прежний id '+id+' читается');
  const a=aluFacadePrice({profile:'F1-17',color:'silver',insert:'satin'},400,700),b=aluFacadePrice({profile:'F1-17',color:'black',insert:'satin'},400,700);
  assert.equal(a.total,b.total);
});

test('смета шкафа: строки рамки — цены клиента калькулятора, без коэффициента и без надбавок бланка',()=>{
  const p=newProject(),m=p.modules[0].module;m.sections[0].drawers=0;delete m.sections[0].drawerConfigs;
  m.alu={profile:'F1-19',color:'gold',insert:aluFill('glass-clear')!.id};
  const door=parts(m).find(x=>x.role==='door')!,e=estimate(p),line=(id:string)=>e.lines.find(l=>l.id===id);
  const s=aluFacadePrice(m.alu,door.width,door.length);
  assert.equal(line('alu-profile:F1-19:gold')!.retail,true);
  assert.ok(Math.abs(line('alu-profile:F1-19:gold')!.quantity*line('alu-profile:F1-19:gold')!.unitPrice!-s.profileCost)<0.5,'количество в смете — до 0,001');
  assert.ok(Math.abs(line('alu-insert:glass-clear')!.quantity*line('alu-insert:glass-clear')!.unitPrice!-s.fillCost)<0.5,'количество в смете — до 0,001 м²');
  assert.equal(line('alu-seal')!.unitPrice,ALU_GASKET_PER_M);
  for(const id of ['alu-film','alu-corners','alu-handle-hole','alu-hinge-hole','alu-hinge-hole-narrow'])assert.equal(line(id),undefined,id+' — нет в калькуляторе');
  assert.ok(line('hinge'),'петли — строкой фурнитуры');
});

test('кухня с алюминиевой рамкой: применить ко всем, без ошибок и пересечений, смета и КП',()=>{
  let p=kitchenProject();
  const first=p.modules.find(a=>a.module.kitchen&&!a.module.bazis&&!a.module.raw&&parts(a.module).some(d=>d.role==='door'))!;
  first.module.alu={...DEFAULT_ALU,insert:aluFill('satin')!.id};
  p=applyFacadeStyle(p,first.id);
  const withAlu=p.modules.filter(a=>a.module.alu);
  assert.ok(withAlu.length>=2,'рамка применилась к кухонным модулям');
  assert.deepEqual(projectErrors(applyAutoFillers(p)),[]);
  for(const a of withAlu){
    assert.deepEqual(validate(a.module),[],a.module.name);
    const ps=parts(a.module);
    assert.deepEqual(partCollisions(ps,a.module),[],a.module.name+': пересечений нет');
    const doors=ps.filter(d=>d.role==='door'&&d.id.includes(':door:'));
    assert.ok(doors.every(d=>d.material==='alu'),'распашные фасады — рамка');
    for(const d of doors.filter(x=>x.hinge==='left'||x.hinge==='right'))assert.ok(ps.some(h=>h.id.startsWith(d.id.replace(':door:',':hingecup:')+':')),d.id+': петли с чашкой стоят');
    assert.match(facadeMaterialLabel(a.module),/^алюминиевая рамка, профиль .+, цвет .+, вставка .+/);
  }
  const e=estimate(p),alu=e.lines.filter(l=>l.id.startsWith('alu-'));
  assert.ok(alu.length>=3&&alu.every(l=>l.unitPrice!==null&&l.retail),'строки рамки с ценой клиента');
  assert.ok(e.lines.some(l=>/^hinge/.test(l.id)),'петли в смете');
});

test('модули из Базиса и сырые модули рамку не получают',()=>{
  let p=kitchenProject();
  const first=p.modules.find(a=>a.module.kitchen&&parts(a.module).some(d=>d.role==='door'))!;
  const other=p.modules.find(a=>a.id!==first.id&&a.module.kitchen&&parts(a.module).some(d=>d.role==='door'))!;
  other.module.bazis=true;
  first.module.alu={...DEFAULT_ALU};
  p=applyFacadeStyle(p,first.id);
  assert.equal(p.modules.find(a=>a.id===other.id)!.module.alu,undefined);
});

test('фасады ящиков в рамке (aluDrawers): шкаф и кухня — рамка 20, без пересечений, в смете и КП; без галочки ящики ЛДСП',()=>{
  const p=newProject(),m=p.modules[0].module;
  m.sections[0].drawers=2;m.sections[0].externalDrawers=true;delete m.sections[0].drawerConfigs; // ящики снаружи, под дверью
  m.alu={...DEFAULT_ALU};
  const plain=parts(m).filter(d=>d.id.endsWith(':facade')&&d.id.includes(':drawer:'));
  assert.ok(plain.length&&plain.every(d=>d.material==='board'),'без галочки — ЛДСП');
  m.aluDrawers=true;
  const ps=parts(m),fr=ps.filter(d=>d.id.endsWith(':facade')&&d.id.includes(':drawer:'));
  assert.ok(fr.every(d=>d.material==='alu'&&d.size[2]===20&&d.edge.every(e=>e===0)));
  for(const d of fr){const b=plain.find(x=>x.id===d.id)!;assert.equal(d.position[2]-d.size[2]/2,b.position[2]-b.size[2]/2,'задняя плоскость фасада на месте');}
  assert.deepEqual(validate(m),[]);assert.deepEqual(partCollisions(ps,m),[]);
  const e=estimate(p),area=[...fr,...ps.filter(d=>d.role==='door'&&d.material==='alu')].reduce((s,d)=>s+d.length*d.width/1e6,0);
  assert.ok(Math.abs(e.lines.find(l=>l.id==='alu-insert:'+DEFAULT_ALU.insert)!.quantity-area)<0.01,'наполнение — по площади дверей и фасадов ящиков');
  assert.ok(describeModule(m).materials.some(x=>/^Фасады ящиков: алюминиевая рамка, профиль/.test(x)));
  let k=kitchenProject();
  const base=k.modules.find(a=>a.module.kitchen?.role==='base'&&!a.module.kitchen.appliance&&parts(a.module).some(d=>d.role==='door'))!;
  setKitchenDrawerCount(base.module,3);base.module.alu={...DEFAULT_ALU};base.module.aluDrawers=true;
  const kp=parts(base.module),kf=kp.filter(d=>d.id.startsWith('kd:')&&d.id.endsWith(':facade'));
  assert.ok(kf.length===3&&kf.every(d=>d.material==='alu'&&d.size[2]===20),'кухонные ящики — рамка');
  assert.deepEqual(validate(base.module),[]);assert.deepEqual(partCollisions(kp,base.module),[],'кухня: пересечений нет');
  k=applyFacadeStyle(k,base.id);
  assert.ok(k.modules.filter(a=>a.module.alu).every(a=>a.module.aluDrawers),'применить ко всем — вместе с ящиками');
  assert.deepEqual(projectErrors(applyAutoFillers(k)),[]);
});
test('aluDrawers без накладных наружных ящиков: вкладные и за дверью остаются ЛДСП — в деталях, в КП и без галочки',()=>{
  const drawerLine=(m:Module)=>describeModule(m).materials.find(x=>x.startsWith('Фасады ящиков:'))!;
  const fronts=(m:Module)=>parts(m).filter(isDrawerFront);
  for(const setup of ['behind','inset'] as const){
    const p=newProject(),m=p.modules[0].module;
    m.sections[0].drawers=2;delete m.sections[0].drawerConfigs;
    if(setup==='behind'){delete m.sections[0].externalDrawers;assert.ok(drawersBehindDoors(m,m.sections[0]));}
    else{m.sections[0].externalDrawers=true;m.sections[0].drawerMount='inset';}
    m.alu={...DEFAULT_ALU};m.aluDrawers=true; // как после «Применить ко всем» с другого модуля
    assert.ok(fronts(m).length&&fronts(m).every(d=>d.material==='board'),setup+': фасады ящиков — ЛДСП');
    assert.deepEqual(aluDrawerFronts(m),[]);
    assert.equal(aluDrawersAvailable(m),false,setup+': галочку не показываем');
    assert.match(drawerLine(m),/^Фасады ящиков: ЛДСП /,setup+': КП не пишет рамку');
    assert.ok(!/алюминиевая рамка/.test(drawerLine(m)));
  }
  const p=newProject(),m=p.modules[0].module;
  m.sections[0].drawers=2;m.sections[0].externalDrawers=true;delete m.sections[0].drawerConfigs;m.alu={...DEFAULT_ALU};
  assert.equal(aluDrawersAvailable(m),true,'накладные наружные — галочка есть');
  m.aluDrawers=true;
  assert.match(drawerLine(m),/^Фасады ящиков: алюминиевая рамка/);
});

test('changeFacadeKind: кухня (keepThickness) сохраняет свою толщину, толщина Вернисажа сбрасывается; шкаф — как раньше',()=>{
  const m=newProject().modules[0].module;m.facadeT=18;
  const a=changeFacadeKind(m,'alu',{keepThickness:true});assert.equal(a.facadeT,18);assert.ok(a.alu);
  const v=changeFacadeKind(a,'vernissage',{keepThickness:true});assert.ok(v.vernissage&&!v.alu&&!v.aluDrawers);
  const back=changeFacadeKind(v,'ldsp',{keepThickness:true});assert.equal(back.facadeT,undefined,'толщина МДФ Вернисажа не остаётся у ЛДСП');
  assert.equal(changeFacadeKind(m,'alu').facadeT,undefined,'без keepThickness — сброс, как у редактора фасадов');
});
test('ALU: высота рамочного фасада — почти по листу стекла поставщика (не 2000 по старому СТП); шире 600 и выше листа — отказ с причиной', async () => {
  const { aluMaxHeight, aluFill, DEFAULT_ALU, ALU_GLASS } = await import('../src/alu');
  const { initialModule, section, parts, validate } = await import('../src/model');
  const { hingeCount } = await import('../src/hardware');
  // лист 3210×2250 (зеркало серебро/бронза/графит, тонировка) — ограничение длины обработки (закалка) 3000
  assert.equal(aluMaxHeight(DEFAULT_ALU).maxH, 3000);
  assert.equal(aluMaxHeight({ ...DEFAULT_ALU, insert: 'glass-bronze' }).maxH, 3000);
  // стандартный лист 2550×1605 (прозрачное, сатин, лакобель): фасад до 2550, вставка 2550 − 29
  const clear = aluMaxHeight({ ...DEFAULT_ALU, insert: 'glass-clear' });
  assert.deepEqual([clear.maxH, clear.glassMax, clear.sheet[0]], [2550, 2550 - 29, 2550]);
  assert.equal(aluMaxHeight({ ...DEFAULT_ALU, insert: 'lacobel-white' }).maxH, 2550);
  const krizet = ALU_FILLS_BY('Кризет б/ц');
  assert.equal(aluMaxHeight({ ...DEFAULT_ALU, insert: krizet }).maxH, 2100);
  assert.equal(ALU_GLASS.allowance, 29);
  // шкаф 440×2500: дверь ~2400 в зеркале — проходит (было «по СТП не выше 2000»); петли по прежнему правилу (выше 2000 — 5)
  const m = { ...initialModule(), width: 440, height: 2500, sections: [{ ...section(), doorLeaves: 1 as const }], doors: true, alu: { ...DEFAULT_ALU } };
  const door = parts(m).find((p) => p.role === 'door' && p.material === 'alu')!;
  assert.ok(door.length > 2300, `дверь ${door.length}`);
  assert.deepEqual(validate(m).filter((e) => /Алюминиевый/.test(e)), []);
  assert.equal(parts(m).filter((p) => p.id.includes(':hingecup:')).length, hingeCount(door.length, door.width));
  // наполнение с малым листом — отказ с причиной (лист поставщика и предел высоты)
  const k = { ...m, alu: { ...DEFAULT_ALU, insert: krizet } };
  assert.match(validate(k).join(' '), /Кризет б\/ц.*лист 2100×1600.*не выше 2100/);
  // ширина — по-прежнему не шире 600
  const wide = { ...m, width: 700 };
  assert.match(validate(wide).join(' '), /не шире 600/);
  void aluFill;
});
function ALU_FILLS_BY(name: string) { return ALU_FILLS.find((f) => f.label === name)!.id; }