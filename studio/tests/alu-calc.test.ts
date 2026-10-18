import test from 'node:test';
import assert from 'node:assert/strict';
import {aluFacadePrice,aluFill,ALU_FILLS,ALU_PROFILES,ALU_GASKET_PER_M,DEFAULT_ALU} from '../src/alu';
import {ALU_CALC_FILLS,ALU_CALC_PROFILES} from '../src/aluData';
import {ALU_CASES} from '../scripts/alu-compare';
import {parts,validate} from '../src/model';
import {newProject,projectErrors,applyAutoFillers} from '../src/project';
import {estimate} from '../src/pricing';
import {partCollisions} from '../src/collisions';
import {kitchenProject} from '../src/kitchenProject';
import {applyFacadeStyle} from '../src/applyFacadeStyle';
import {facadeMaterialLabel} from '../src/quoteDescribe';

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
});

test('данные рамки — из калькулятора: все профили и наполнения (включая узорчатые), цвет на цену не влияет',()=>{
  assert.deepEqual(ALU_PROFILES.map(p=>p.id),ALU_CALC_PROFILES.map(p=>p.id));
  assert.equal(ALU_FILLS.length,ALU_CALC_FILLS.length);
  assert.ok(ALU_FILLS.some(f=>f.group==='Узорчатые (склад)')&&ALU_FILLS.some(f=>f.group==='Узорчатые (заказные)'),'узорчатые стёкла калькулятора');
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
