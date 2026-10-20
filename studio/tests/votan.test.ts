import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parts,parseModule,validate,initialModule,RULES} from '../src/model';
import {estimate,lineGroup} from '../src/pricing';
import {VOTAN_DEFAULT,parseVotan,votanProject} from '../src/votan';
import {aluFill} from '../src/alu';
test('order parameters survive roundtrip; malformed numeric input fails',()=>{
  assert.deepEqual(parseVotan(JSON.parse(JSON.stringify(VOTAN_DEFAULT))),VOTAN_DEFAULT);
  assert.throws(()=>parseVotan({...VOTAN_DEFAULT,pantsWidth:NaN}));
  assert.throws(()=>parseVotan({...VOTAN_DEFAULT,shelfCount:2.5}));
  assert.throws(()=>parseVotan({...VOTAN_DEFAULT,version:3}));
});
test('all ten module geometries survive module import and have positive finite parts',()=>{
  const p=votanProject(VOTAN_DEFAULT);assert.equal(p.modules.length,10);
  for(const a of p.modules){assert.deepEqual(validate(a.module),[]);assert.deepEqual(parts(parseModule(a.module)),parts(a.module));for(const q of parts(a.module)){assert.ok(q.size.every(x=>x>0&&Number.isFinite(x)));assert.ok(q.position.every(Number.isFinite));}}
});
test('four drawer faces are 320 320 320 120 with exact 30 mm clear gaps',()=>{
  const m=votanProject(VOTAN_DEFAULT).modules.find(a=>a.id==='B2')!.module;
  const fs=parts(m).filter(q=>q.id.endsWith(':facade')).sort((a,b)=>a.position[1]-b.position[1]);
  assert.deepEqual(fs.map(q=>q.size[1]),[320,320,320,120]);
  assert.equal(fs[0].position[1]-fs[0].size[1]/2,12);
  for(let i=1;i<4;i++)assert.equal(fs[i].position[1]-fs[i].size[1]/2-fs[i-1].position[1]-fs[i-1].size[1]/2,30);
  assert.equal(parts(m).filter(q=>q.role==='door').length,0);
  assert.equal(parts(m).filter(q=>q.id.includes(':shelf:')).length,2);
});
test('through module has side by side drawers, one shared shelf and 32 mm fillers',()=>{
  const m=votanProject(VOTAN_DEFAULT).modules.find(a=>a.id==='B1')!.module,ps=parts(m);
  assert.equal(m.width,1800);
  const f=ps.filter(q=>q.id.endsWith(':facade'));assert.equal(f.length,2);assert.equal(f[0].position[1],f[1].position[1]);assert.notEqual(f[0].position[0],f[1].position[0]);
  assert.equal(ps.filter(q=>q.id.endsWith(':drawer-cap')).length,1);
  assert.deepEqual(ps.filter(q=>q.id.includes(':filler:')).map(q=>q.size[0]),[32,32]);
});
test('650 is between mounting faces; no drawer under trousers; upper is unpartitioned',()=>{
  const p=votanProject(VOTAN_DEFAULT),m=p.modules.find(a=>a.id==='A2')!.module,ps=parts(m);
  const stand=ps.find(q=>q.id.endsWith(':pants-divider'))!,right=ps.find(q=>q.id==='right')!;
  assert.equal(right.position[0]-right.size[0]/2-stand.position[0]-stand.size[0]/2,650);
  assert.equal(ps.filter(q=>q.id.includes(':drawer:')).length,0);
  for(const a of p.modules.filter(a=>a.id.endsWith('-top'))){assert.equal(parts(a.module).filter(q=>q.id.includes('divider')||q.role==='shelf').length,0);}
});
// Решение Макса 20.10.2026: «в горизонтах 4000 ₽, в вертикалях 3000 ₽» — подсветка в крыше горизонтальная → 4000 ₽/пог.м
test('подсветка в крышах Вотан — строка «Подсветка в крыше» 4000 ₽/пог.м, розница, не «в стойках» по 3000',()=>{
  const on=votanProject({...VOTAN_DEFAULT,light:true}),off=votanProject({...VOTAN_DEFAULT,light:false});
  const len=on.modules.flatMap(a=>parts(a.module).filter(q=>q.role==='light'&&q.id.endsWith(':light:roof'))).reduce((s,q)=>s+q.length,0)/1000;
  assert.ok(len>0);
  const e=estimate(on),row=e.lines.find(l=>l.id==='light-roof')!;
  assert.ok(row,'строка подсветки в крыше есть');assert.equal(row.label,'Подсветка в крыше');
  assert.equal(row.unitPrice,RULES.shelfLightRetailPerM);assert.equal(row.unitPrice,4000);assert.equal(row.retail,true);
  assert.ok(Math.abs(row.quantity-len)<0.001,`длина ${row.quantity} = сумма профилей ${len}`);
  assert.ok(!e.lines.some(l=>l.id==='light-stand'),'не считается как подсветка в стойках');
  assert.equal(lineGroup('light-roof'),'hardware');
  const e0=estimate(off);
  assert.equal(e.byMarkupKnown!-e0.byMarkupKnown!,Math.round(len*4000),'итог растёт ровно на длину × 4000 (поверх коэффициента)');
  assert.equal(e.split.hardware-e0.split.hardware,Math.round(len*4000));
  assert.equal(e.split.material,e0.split.material);
});
// Страховка правила: по цене стоек (light-stand, 3000) идут только вертикальные профили — горизонтальные (ширина > высоты) все по 4000
test('подсветка по цене стоек — только вертикальные профили (Вотан, шкаф со стойками и полками)',()=>{
  const w=initialModule();w.standLight=true;w.sections[0].shelves=[0.3,0.6];w.sections[0].shelfLight=true;
  const mods=[...votanProject({...VOTAN_DEFAULT,light:true}).modules.map(a=>a.module),w];
  for(const m of mods)for(const q of parts(m).filter(q=>q.role==='light'&&!q.id.startsWith('groove:'))){
    const horizontal=q.size[0]>q.size[1]||q.size[2]>q.size[1],toStand=!q.id.includes(':shelf-light:')&&!q.id.endsWith(':light:roof');
    assert.equal(toStand,!horizontal,`${q.id} (${q.size.join('×')}): ${horizontal?'горизонталь — 4000':'вертикаль — 3000'}`);
  }
});
test('lights are horizontal in lower roofs; no support feet; glass prices from the ALU calculator',()=>{
  const p=votanProject(VOTAN_DEFAULT);
  const lights=p.modules.flatMap(a=>parts(a.module).filter(q=>q.role==='light').map(q=>({a,q})));
  assert.equal(lights.length,3);for(const {a,q} of lights){assert.ok(!a.id.endsWith('-top'));assert.equal(q.position[1],a.module.height-18);assert.ok(q.size[0]>q.size[2]);}
  assert.ok(p.modules.every(a=>!a.module.feet&&a.module.plinthHeight===0));
  // стёкла ТЗ Вотан — по калькулятору фасадов ALU: Мору бронза / графит, стекло сатин бронзовый
  assert.equal(aluFill('moru-bronze')!.perM2,15625);assert.equal(aluFill('satin-bronze')!.perM2,7910);
});
