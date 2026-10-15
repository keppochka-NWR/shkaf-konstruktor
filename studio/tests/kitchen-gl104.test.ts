import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon,GL_NAMES} from '../scripts/kitchen/fromEtalon';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {GL104} from '../src/kitchenLift';

// Пакет 6: газлифт GL104 с фиксацией положения (backlog F_LIFT_GL) — антресоли k01 m11–m13, единственный проект базы с ним.
// Эталоны вне репозитория — без них тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('GL104: k01 m11–m13 распознаны функцией студии и PASS (8 узлов газлифта, 10 саморезов D3×3, без «не поддержано»)',{skip:!has('k01')},()=>{
  for(const key of ['m11','m12','m13']){
    const ref=load('k01',key),r=moduleFromEtalon(ref),err=validate(r.module),c=compareModule(ref,r.module);
    assert.deepEqual(r.module.kitchenLift,{system:'gl104'},key);
    assert.deepEqual(r.unsupported,[],key);
    assert.deepEqual(err,[],key);
    assert.ok(honestPass(c,err,r.unsupported),key);
    const ps=parts(r.module),lift=ps.filter(p=>p.id.startsWith('lift:'));
    assert.equal(lift.length,8,key);
    assert.ok(lift.every(p=>p.model?.file?.startsWith('hardware/bazis/')),key);
    const hs=holes(r.module).filter(h=>h.src.startsWith('lift:'));
    assert.equal(hs.length,10,key);
    assert.ok(hs.every(h=>h.d===3&&h.depth===3),key);
    assert.deepEqual(partCollisions(ps,r.module).filter(c=>c.a.startsWith('lift:')||c.b.startsWith('lift:')),[],key);
    assert.equal(ps.find(p=>p.role==='door')!.name.includes('GL104'),true);
  }
});

// одно определение узлов комплекта (fromEtalon GL_NAMES) — его же берёт buildKitchen (markBazis), второго литерала нет
test('GL104: GL_NAMES — ровно 4 узла комплекта Базиса k01 m11, прочие имена не узлы',{skip:!has('k01')},()=>{
  const names=[...new Set(load('k01','m11').hardware.map(h=>h.name).filter(n=>GL_NAMES.test(n)))].sort();
  assert.deepEqual(names.map(n=>n.trim()).sort(),['Газ патрон','Кронштейн на боковину','Кронштейн на фасад','Шток для GL 104']);
  for(const n of ['Газлифт PD-G-N02','Кронштейн','Шток для GL 105','Кронштейн на фасад 2'])assert.equal(GL_NAMES.test(n),false,n);
  assert.equal(readFileSync(new URL('../scripts/kitchen/buildKitchen.ts',import.meta.url),'utf8').includes('Шток для GL'),false,'второго литерала нет');
});

test('GL104: точки от низа боковины, внутренней грани и тыльной плоскости фасада; поле читается; низкий фасад — ошибка',{skip:!has('k01')},()=>{
  const m=moduleFromEtalon(load('k01','m12')).module;
  const ps=parts(m),L=ps.find(p=>p.id==='left')!,face=ps.find(p=>p.id==='lift:left:gl-face')!,side=ps.find(p=>p.id==='lift:right:gl-side')!;
  const inner=L.position[0]+L.size[0]/2,bot=L.position[1]-L.size[1]/2;
  assert.deepEqual(face.model!.origin!.slice(0,2),[inner+GL104.face[0],bot+GL104.face[1]]);
  const R=ps.find(p=>p.id==='right')!;
  assert.equal(side.model!.origin![0],R.position[0]-R.size[0]/2);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchenLift,{system:'gl104'});
  // шире: комплект остаётся у боковин (от внутренней грани)
  const wide=parseModule(JSON.parse(JSON.stringify(m)));wide.width+=100;
  const R2=parts(wide).find(p=>p.id==='right')!,s2=parts(wide).find(p=>p.id==='lift:right:gl-side')!;
  assert.equal(s2.model!.origin![0],R2.position[0]-R2.size[0]/2);
  assert.deepEqual(validate(wide),[]);
  // ниже 300: кронштейн на фасад (268,5 + 25,5 от низа боковины) уже не перекрыт фасадом — честная ошибка
  const low=parseModule(JSON.parse(JSON.stringify(m)));low.height=280;
  assert.ok(validate(low).some(e=>e.includes('GL104')),JSON.stringify(validate(low)));
  // каждая принятая высота — без пересечений комплекта (300–305: кронштейн входил в крышу тихо — теперь ошибка validate)
  for(let H=280;H<=420;H+=5){const h=parseModule(JSON.parse(JSON.stringify(m)));h.height=H;
    if(!validate(h).length)assert.deepEqual(partCollisions(parts(h),h).filter(c=>c.a.startsWith('lift:')||c.b.startsWith('lift:')).map(c=>c.names.join('×')),[],`H=${H}`);
    else assert.ok(H<310,`H=${H}: ${validate(h)}`);}
});

// слияние пакетов 5 и 6 (15.10): GL104 стоит от низа боковины, а не от верха ряда — у навесного в два ряда подъёмных (F_LIFT_MULTI, k07 m08)
// второй комплект встал бы в ту же точку; validate говорит об этом, PD-G-N02 по рядам — без такой ошибки
test('GL104 + два ряда подъёмных фасадов (k07 m08) — ошибка validate «один ряд», PD-G-N02 — без неё',{skip:!has('k07')},()=>{
  const m=moduleFromEtalon(load('k07','m08')).module;
  assert.equal(m.kitchenLift?.system,'pd-g-n02');
  assert.ok(!validate(m).some(e=>/один ряд подъёмных фасадов/.test(e)));
  const gl={...m,kitchenLift:{system:'gl104' as const}};
  assert.ok(validate(gl).some(e=>/GL104 по Базису — один ряд подъёмных фасадов/.test(e)));
  const ids=parts(gl).filter(p=>p.id.startsWith('lift:')).map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length,'id деталей газлифта не повторяются');
});
