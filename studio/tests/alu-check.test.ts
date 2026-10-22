import test from 'node:test';
import assert from 'node:assert/strict';
import {aluFacadePrice,aluFill,ALU_FILLS,ALU_FILL_GROUPS} from '../src/alu';
import {ALU_CALC_FILLS,ALU_CALC_PROFILES,ALU_CALC_GASKET_PER_M,ALU_CALC_HINGE_SPLIT_H,ALU_CALC_VERSION} from '../src/aluData';
import {ALU_CASES,ALU_CHECK_CASES,aluDataDiff,runCalculator,studioAlu} from '../scripts/alu-compare';

// Сверка 22.10.2026: 10 разных фасадов против оригинального calcOneFasad калькулятора фасадов ALU (исполнен в node:vm,
// scripts/alu-compare.ts <путь к calc-platform>). Петли и подъёмник в калькуляторе — закупка × FASAD_HINGE_MARKUP 2:
// GTV стандарт 220, Hettich 1000, GTV Air Soft 7000 ₽/шт, подъёмник 1000 ₽/компл (в студии это отдельные строки фурнитуры).
const CALC_HINGE={'gtv-std':440,hettich:2000,'gtv-air':14000} as const,CALC_LIFT=2000;

test('10 фасадов сверки 22.10: цена фасада студии = calcOneFasad калькулятора (профиль + наполнение + уплотнитель)',()=>{
  assert.equal(ALU_CHECK_CASES.length,10);
  assert.deepEqual([...new Set(ALU_CHECK_CASES.map(c=>c.profile))].sort(),ALU_CALC_PROFILES.map(p=>p.id).sort(),'все профили калькулятора');
  for(const c of ALU_CHECK_CASES){
    const f=ALU_FILLS.find(x=>x.label===c.fill);assert.ok(f,c.fill+' есть в студии');
    const s=aluFacadePrice({profile:c.profile,color:'silver',insert:f!.id},c.w,c.h);
    assert.ok(Math.abs(s.total-c.calcNoHinge)<0.01,`${c.profile} ${c.w}×${c.h} ${c.fill}: студия ${s.total} ≠ калькулятор ${c.calcNoHinge}`);
    // итог калькулятора с его петлями/подъёмником — до рубля (calcNoHinge записан до копейки, отсюда допуск 0,5 ₽)
    assert.equal(c.calcHinges,c.h<=ALU_CALC_HINGE_SPLIT_H?2:3,'петли калькулятора: 2 до 1200 мм, 3 выше');
    const hinge=CALC_HINGE['hinge' in c?c.hinge:'gtv-std'],lift='openDir' in c&&c.openDir==='up'?CALC_LIFT:0;
    assert.ok(Math.abs(c.calcNoHinge+c.calcHinges*hinge+lift-c.calc)<=0.505,`${c.w}×${c.h}: итог калькулятора ${c.calc}`);
  }
  // группы наполнений сверки: все пять групп калькулятора
  assert.deepEqual([...new Set(ALU_CHECK_CASES.map(c=>ALU_FILLS.find(f=>f.label===c.fill)!.group))].sort(),[...ALU_FILL_GROUPS].sort());
});

test('граничные случаи: дробный размер, прежние id наполнений, ЛДСП в рамке недоступно (как в калькуляторе)',()=>{
  const g=aluFill('glass-graphite')!,m=aluFill('moru-bronze')!;
  assert.equal(g.label,'Стекло тонированное Графит 4мм');assert.equal(m.label,'Мору бронза / графит');
  const half=aluFacadePrice({profile:'F1-09',color:'silver',insert:g.id},397.5,716);
  assert.ok(Math.abs(half.total-5558.80)<0.01,'ширина 397,5 мм — без округления размера');
  // калькулятор берёт в фасады только группы FASAD_FILL_GROUPS (без ЛДСП и плёнок) — студия тоже
  assert.ok(!ALU_FILLS.some(f=>/ЛДСП|Оракал|Плёнк/i.test(f.label+f.group)),'ЛДСП и плёнок в рамке нет');
});

test('aluDataDiff: данные студии против самих себя — без расхождений; изменённая цена или профиль находятся',()=>{
  const self={version:ALU_CALC_VERSION.fasad,fillings:ALU_CALC_VERSION.fillings,groups:ALU_FILL_GROUPS,markup:3,gasket:ALU_CALC_GASKET_PER_M,
    profiles:ALU_CALC_PROFILES.map(p=>({id:p.id,name:p.name,pricePerM:p.perM/3})),fills:ALU_CALC_FILLS.map(f=>({...f}))};
  assert.deepEqual(aluDataDiff(self),[]);
  const fills=self.fills.map((f,i)=>i===0?{...f,p:f.p+100}:f);
  assert.equal(aluDataDiff({...self,fills}).length,1);
  assert.match(aluDataDiff({...self,profiles:self.profiles.filter(p=>p.id!=='F1-09')})[0],/профили: калькулятор F1-17,F1-19/);
});

test('смета округляет количество строк рамки до 0,001: отклонение от калькулятора не больше 0,0005 м² × цена наполнения',()=>{
  for(const c of [...ALU_CASES,...ALU_CHECK_CASES]){
    const s=studioAlu(c)!,f=ALU_FILLS.find(x=>x.label===c.fill)!;
    assert.ok(Math.abs(s.estimate-s.total)<=0.0005*f.perM2+1e-6,`${c.w}×${c.h}: смета ${s.estimate}, фасад ${s.total}`);
  }
});

// Живая сверка с исходным кодом калькулятора — только локально: ALU_CALC_ROOT=<путь к calc-platform>
const root=process.env.ALU_CALC_ROOT;
test('живая сверка: оригинальный calcOneFasad и данные калькулятора',{skip:!root&&'ALU_CALC_ROOT не задан'},()=>{
  const all=[...ALU_CASES,...ALU_CHECK_CASES],live=runCalculator(root!,all);
  assert.deepEqual(aluDataDiff(live),[],'aluData.ts = калькулятор');
  live.res.forEach((r,i)=>{
    assert.ok(!r.missing,all[i].fill+' есть в калькуляторе');
    assert.ok(Math.abs(r.noHinge-all[i].calcNoHinge)<0.01);assert.equal(Math.round(r.total),all[i].calc);
  });
});
