import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,facadeTop,section,parseModule} from '../src/model';
import {kitchenWall,mirrorKitchen} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Пакет 5 развития калькулятора: секции, составные корпуса, сетка фасадов (backlog F_STACKED, F_PARTITION, F_ROWS…).
// Эталоны вне репозитория — тесты с ними пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const box=(p:{size:number[];position:number[]})=>p.position.map((v,i)=>[+(v-p.size[i]/2).toFixed(1),+(v+p.size[i]/2).toFixed(1)]);

test('F_STACKED: пенал на опорах, верхний ряд дверей выше боковин — kitchen.faceTop < 0; шкаф студии — без поля, как прежде',()=>{
  const m=initialModule();m.kitchen={role:'tall',faceTop:-388.5};m.feet={height:100};m.height=2460;m.width=600;m.depth=577;
  m.doors=true;m.sections[0].doorSplit=1797.5;m.sections[0].doorLeaves=1;m.sections[0].shelves=[];
  assert.equal(facadeTop(m),2848.5,'верх фасадов = верх корпуса + 388,5');
  const doors=parts(m).filter(p=>p.role==='door').map(box).sort((a,b)=>a[1][0]-b[1][0]);
  assert.equal(doors.length,2,'два ряда по одной створке');
  assert.equal(doors[1][1][1],2848.5,'верхний ряд выше боковин');
  // без опор поле не действует (как и прежде у faceTop): верх фасадов — от высоты корпуса
  const n=structuredClone(m);delete n.feet;assert.ok(facadeTop(n)<n.height);
});

test('F_STACKED (k31 m18, m19): фасады выше боковин на 388,5 — разрез рядов как в Базисе, петли 6/6, без «не поддержано» по фасадам',{skip:!has('k31')},()=>{
  for(const key of ['m18','m19']){
    const ref=load('k31',key),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
    assert.equal(r.module.kitchen?.faceTop,-388.5,key);
    assert.ok(!r.unsupported.some(u=>/выше боковин/.test(u)),key+' '+r.unsupported.join('; '));
    assert.equal(c.missing.filter(x=>/Дверь/.test(x.name)).length,0,key+' двери Базиса на месте');
    assert.equal(c.extra.filter(x=>/Фасад/.test(x.name)).length,0,key+' лишних фасадов нет');
    const h=c.hardware.find(x=>x.category==='петля')!;assert.equal(h.ref,h.studio,key+' петли');assert.equal(h.maxPosDelta,0,key+' места петель');
    assert.ok(!validate(r.module).length,key+' '+validate(r.module).join('; '));
  }
});

test('F_STACKED: пенал из двух корпусов (k30 m05: боковины 850, фасады до 2469, верхний ряд от 712) — не разрез, честно «не поддержано»',{skip:!has('k30')},()=>{
  const r=moduleFromEtalon(load('k30','m05'));
  assert.equal(r.module.kitchen?.faceTop,undefined);assert.ok(r.unsupported.some(u=>/выше боковин/.test(u)),r.unsupported.join('; '));
});

// F_PARTITION: навесной k31 m11 своими словами — 1000×795×320, ХДФ в паз, перегородка от задней кромки паза (20) до лица,
// снизу эксцентрик в левую пласть + шкант на 32 ближе к середине, сверху конфирматы; точки в 54 от кромок перегородки
function wall2(){
  const m=kitchenWall(initialModule(),1000);m.name='ВМ синт.';m.height=795;m.depth=320;m.bazis=true;m.doors=false;
  const s1={...section(),shelves:[0.5],drawers:0,shelfDepth:280};m.sections=[{...m.sections[0],shelves:[0.5],drawers:0,shelfDepth:280,weight:500},{...s1,weight:452}];
  m.kitchen={...m.kitchen!,divider:{z0:20,bottom:{kind:'ecc',ins:[54,54],face:'left',dowel:32},top:{kind:'conf',ins:[54,54]}}};
  return m;
}
const pid=(m:ReturnType<typeof wall2>,re:RegExp)=>parts(m).filter(p=>re.test(p.id));

test('F_PARTITION: перегородка секций кухни Базиса — от z0 до лица боковин, между дном и крышей (шкаф студии — как прежде)',()=>{
  const m=wall2(),dv=pid(m,/:divider$/);
  assert.equal(dv.length,1);assert.deepEqual(box(dv[0])[2],[20,320],'по глубине — от z0 до лица');
  assert.deepEqual(box(dv[0])[0],[516,532],'после первой секции 500');
  assert.deepEqual(validate(m),[]);
  const w=initialModule();w.sections=[w.sections[0],{...section(),weight:1}];
  const wd=parts(w).find(p=>p.id.endsWith(':divider'))!;assert.ok(box(wd)[2][1]<w.depth,'шкаф: перегородка короче глубины, как раньше');
});

test('F_PARTITION: крепёж концов по проекту — эксцентрик (бочонок в пласть в 34 от дна, шток в торец, D5 в дно) + шкант; конфирматы через крышу',()=>{
  const m=wall2(),ps=parts(m),hs=holes(m,ps);
  assert.equal(pid(m,/^ecc:kdiv-bottom-left:/).filter(p=>!p.id.endsWith(':pin')).length,2);
  assert.equal(pid(m,/^dowel:kdiv-bottom:/).length,2);
  assert.equal(pid(m,/^fast:.*:divider:top:/).length,2);
  const dvId=ps.find(p=>p.id.endsWith(':divider'))!.id,onDv=hs.filter(h=>h.part===dvId);
  const barrel=onDv.filter(h=>h.d===15);assert.deepEqual(barrel.map(h=>h.at).sort((a,b)=>a[2]-b[2]),[[516,50,74],[516,50,266]],'D15 в левой пласти в 34 над дном, 54 от кромок');
  assert.ok(barrel.every(h=>h.dir[0]===1&&h.depth===12));
  assert.equal(onDv.filter(h=>h.d===8&&h.depth===34).length,2,'шток D8×34 в нижний торец');
  assert.deepEqual(onDv.filter(h=>h.d===8&&h.depth===22).map(h=>h.at[2]).sort((a,b)=>a-b),[106,234],'шканты на 32 ближе к середине');
  assert.equal(hs.filter(h=>h.part==='bottom'&&h.d===5&&h.depth===12).length,2,'D5×12 в дно');
  assert.equal(onDv.filter(h=>h.d===5&&h.at[1]>700).length,2,'конфирматы сверху — D5 в торец перегородки');
  assert.deepEqual(partCollisions(ps,m).filter(c=>c.names.some(n=>/Перегородка|Эксцентрик|Шкант/.test(n))),[]);
});

test('F_PARTITION: зеркало переносит бочонок в другую пласть, поле переживает сохранение; ошибки — честные',()=>{
  const m=wall2();mirrorKitchen(m);assert.equal(m.kitchen!.divider!.bottom!.face,'right');
  const back=parseModule(JSON.parse(JSON.stringify(wall2())));assert.deepEqual(back.kitchen?.divider,wall2().kitchen!.divider);
  const bad=wall2();bad.kitchen!.divider!.bottom!.ins=[200,200];assert.ok(validate(bad).some(e=>/Перегородка кухни/.test(e)));
  const one=wall2();one.sections=[one.sections[0]];assert.ok(validate(one).some(e=>/двух секций/.test(e)));
});

test('F_PARTITION (k31 m11): перегородка — вторая секция, крепёж как в Базисе: эксцентрики/шканты/конфирматы сходятся, панели все на месте',{skip:!has('k31')},()=>{
  const ref=load('k31','m11'),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
  assert.equal(r.module.sections.length,2);
  assert.deepEqual(r.module.kitchen?.divider,{z0:20,bottom:{kind:'ecc',ins:[54,54],face:'left',dowel:32},top:{kind:'conf',ins:[54,54]}});
  assert.ok(!r.unsupported.length,r.unsupported.join('; '));
  assert.equal(c.missing.length,0);assert.equal(c.extra.length,0);
  for(const cat of ['эксцентрик','конфирмат','шкант']){const h=c.hardware.find(x=>x.category===cat)!;assert.equal(h.ref,h.studio,cat);}
  // остаётся особенность Базиса: полки правой секции на 9 мм заходят в правую боковину (544,5…1393 при боковине от 1384) — не правило
  assert.ok(c.pairs.some(p=>p.delta===10));
});

test('F_PARTITION: перегородка до жёсткой полки (k03 m12) и пенал с фасадами не по секциям (k14 m01) — честно не распознаются',{skip:!has('k03')||!has('k14')},()=>{
  assert.equal(moduleFromEtalon(load('k03','m12')).module.sections.length,1);
  const r=moduleFromEtalon(load('k14','m01'));assert.equal(r.module.sections.length,1);assert.ok(r.unsupported.some(u=>/сетка фасадов/.test(u)));
});

// F_LIFT_MULTI: навесной в два ряда подъёмных фасадов (k07 m08/m11 «вм 3»/«ВМ 6», 800×920): каждый ряд на петлях по своей горизонтали
// (жёсткая полка, крыша), газлифт PD-G-N02 — комплект на каждую боковину у каждого ряда; привязка нижнего ряда — середина зазора до верхнего
test('F_LIFT_MULTI (k07 m08): два ряда подъёмных фасадов с газлифтами — PASS, 16 деталей газлифта и 20 саморезов как в Базисе',{skip:!has('k07')},()=>{
  const ref=load('k07','m08'),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
  assert.deepEqual(r.module.kitchenLift,{system:'pd-g-n02'});assert.deepEqual(r.module.sections[0].doorHinges,['top','top','top','top']);
  assert.equal(honestPass(c,validate(r.module),r.unsupported),true,JSON.stringify(r.unsupported));
  const lifts=parts(r.module).filter(p=>p.id.startsWith('lift:'));
  assert.equal(lifts.filter(p=>p.id.endsWith(':block')).length,4,'газблок: 2 ряда × 2 боковины');
  assert.equal(lifts.filter(p=>/:r1:/.test(p.id)).length,lifts.length/2,'второй ряд — свои id (lift:<сторона>:r1:…)');
  const blocks=lifts.filter(p=>p.id.endsWith(':block')&&p.id.startsWith('lift:left:')).map(p=>p.model!.origin![1]).sort((a,b)=>a-b);
  assert.deepEqual(blocks,[369.5,828],'нижний ряд — от середины зазора (460 − 90,5), верхний — от верха фасада (918,5 − 90,5)');
  // ширина ±100 — комплекты остаются у своих рядов, без ошибок
  const w=structuredClone(r.module);w.width+=100;assert.deepEqual(validate(w),[]);assert.equal(parts(w).filter(p=>p.id.startsWith('lift:')&&p.id.endsWith(':block')).length,4);
});

// газлифт нижнего ряда не входит в дно: тот же предел LIFT_DROP, что у верхнего ряда, по верху ряда (середине зазора) — граница
// рядов меняется полем «Высота нижнего ряда фасадов» (doorSplit)
function wallLift2(){
  const w=kitchenWall(initialModule(),800);w.height=920;w.depth=300;w.doors=true;w.kitchenLift={system:'pd-g-n02'};
  w.sections=[{...w.sections[0],shelves:[],shelfDepth:250,doorLeaves:1,doorSplit:460,doorHinges:['top','top','top','top']}];return w;
}
test('F_LIFT_MULTI: газлифт нижнего ряда входит в дно — ошибка с запасом до дна, а не тихое пересечение',()=>{
  assert.deepEqual(validate(wallLift2()),[]);
  for(const [ds,lack] of [[300,0],[280,4],[270,14],[250,34],[230,54]] as const){
    const m=wallLift2();m.sections[0].doorSplit=ds;const e=validate(m);
    if(!lack)assert.deepEqual(e,[],String(ds));
    else{assert.equal(e.length,1,ds+' '+e.join('; '));assert.match(e[0],new RegExp(`1-й ряд фасадов снизу.*входит в дно.*на ${lack} мм`),String(ds));}
    // низ комплекта нижнего ряда по деталям: при ошибке — ниже грани дна (16), без ошибки — выше
    const lo=Math.min(...parts(m).filter(p=>p.id.startsWith('lift:')).map(p=>p.position[1]-p.size[1]/2));
    assert.equal(lo<16,lack>0,ds+' низ комплекта '+lo);
  }
});
test('F_LIFT_MULTI: два подъёмных фасада рядом в одном ряду — ошибка про ряд; два ряда по одному — без ошибки',()=>{
  const m=wallLift2();m.sections[0].doorLeaves=2;
  assert.ok(validate(m).some(e=>/в каждом ряду на один подъёмный фасад/.test(e)),validate(m).join('; '));
});
test('F_LIFT_MULTI (k07 m08): граница рядов 270/250/230 — газлифт нижнего ряда в дне или ниже корпуса, validate это видит',{skip:!has('k07')},()=>{
  const r=moduleFromEtalon(load('k07','m08'));
  for(const ds of [270,250,230]){const m=structuredClone(r.module);m.sections[0].doorSplit=ds;assert.ok(validate(m).some(e=>/1-й ряд фасадов снизу.*входит в дно/.test(e)),String(ds));}
});

test('F_LIFT_MULTI: один подъёмный фасад — те же id и места газлифта, что раньше (k10 m03)',{skip:!has('k10')},()=>{
  const r=moduleFromEtalon(load('k10','m03'));
  const ids=parts(r.module).filter(p=>p.id.startsWith('lift:')).map(p=>p.id);
  assert.ok(ids.length>0&&ids.every(id=>!/:r\d+:/.test(id)),ids.join(','));
});

test('F_LIFT_MULTI (k07 m11): петли нижнего ряда в 114,5 от кромок при 100 у верхнего — своих мест по рядам нет, честно FAIL',{skip:!has('k07')},()=>{
  const ref=load('k07','m11'),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
  assert.equal(honestPass(c,validate(r.module),r.unsupported),false);
  assert.equal(c.hardware.find(h=>h.category==='газлифт')!.maxPosDelta,0,'газлифты обоих рядов на месте');
});
