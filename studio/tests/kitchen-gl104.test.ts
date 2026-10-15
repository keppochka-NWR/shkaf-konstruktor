import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
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
