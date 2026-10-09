import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {faceGapsTB} from '../scripts/kitchen/recognize-base';

// Нижние модули кухни «как в Базисе» (поток n4). Эталоны вне репозитория — на чужой машине тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3),holes:c.holes?.extra.slice(0,3)});
const pass=(k:string,key:string)=>{const ref=load(k,key);const r=moduleFromEtalon(ref);const err=validate(r.module);const c=compareModule(ref,r.module);return {ok:honestPass(c,err,r.unsupported),m:r.module,info:why(c)+JSON.stringify(err)+JSON.stringify(r.unsupported)};};

test('глухой фасад под нишей духовки (k03 m01, k06 m04): фасад без петель ниже верха корпуса на высоту ниши — сверка PASS',{skip:!has('k03')||!has('k06')},()=>{
  for(const [k,key] of [['k03','m01'],['k06','m04']] as const){
    const r=pass(k,key);
    assert.ok(r.ok,`${k} ${key}: ${r.info}`);
    assert.equal(r.m.kitchen?.hinges,false);
    assert.ok((r.m.kitchen?.faceTop??0)>500,'верх фасада — под нишей');
    assert.equal(parts(r.m).filter(p=>/:(hingecup|hingeplate):/.test(p.id)).length,0,'петель нет');
  }
});

test('ниша над фасадом — только у фасада без петель: с петлями большой отступ не зазор (k22 m06)',{skip:!has('k22')},()=>{
  const ref=load('k22','m06');
  assert.equal(faceGapsTB(ref,1.5),undefined);
  assert.equal(moduleFromEtalon(ref).module.kitchen?.faceTop,undefined);
});

test('минимум высоты распашного фасада 200 снят только у кухни без петель; шкафы и кухня с петлями — как было',()=>{
  const m=initialModule();
  assert.ok(!validate(m).some(e=>e.includes('ниже 200')));
  const k=moduleFromEtalon(has('k03')?load('k03','m01'):({} as RefModule));
  if(has('k03')){
    const withHinges={...k.module,kitchen:{...k.module.kitchen!,hinges:undefined}};
    assert.ok(validate(withHinges).some(e=>e.includes('ниже 200')),'с петлями фасад 117 мм — ошибка, как раньше');
  }
});
