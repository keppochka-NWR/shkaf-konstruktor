import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {edgeByDir} from '../src/edges';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon,clusterLegXs,hingelessDoors} from '../scripts/kitchen/fromEtalon';
import {estimate} from '../src/pricing';
import {partCollisions} from '../src/collisions';
import {newProject} from '../src/project';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тест пропускается.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('пенал k12 m04: два ряда распашных = doorSplit, фикс. полки на эксцентриках со шкантом, кромка фикс. полок перед+зад — сверка с Базисом PASS',{skip:!existsSync(`${ETALON}/k12.json`)},()=>{
  const ref=load('k12','m04');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.sections[0].doorSplit,1198.5,'разрез: от низа нижнего фасада 101.5 до середины зазора 1298.5…1301.5');
  assert.equal(m.sections[0].doorLeaves,1);
  assert.equal(m.faceGapBetween,3,'зазор между рядами 3');
  const sid=m.sections[0].id;
  for(const j of m.sections[0].fixed??[])for(const side of ['left','right'])assert.equal(m.jointFastening?.[`${sid}:shelf:${j}:${side}`],'eccentric');
  const ps=parts(m);
  for(const j of m.sections[0].fixed??[]){const sh=ps.find(p=>p.id===`${sid}:shelf:${j}`)!;assert.ok(sh,'фикс. полка '+j);}
  const c=compareModule(ref,m);
  assert.ok(c.pass,JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3)}));
});

test('пенал под духовку k23 m15: ниша 385,5 мм между рядами фасадов — doorNiche (не зазор разреза), нижний ряд 812,5 + 1,5',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const {module:m,unsupported}=moduleFromEtalon(load('k23','m15'));
  assert.equal(m.sections[0].doorSplit,814);
  assert.equal(m.sections[0].doorNiche,385.5);
  assert.equal(m.faceGapBetween,3);
  assert.ok(!unsupported.some(u=>u.startsWith('ниша')),unsupported.join('; '));
});

test('пенал с нишей k31 m01: фасады двух рядов и петли — как в Базисе (ниша 1018,5), рафиксы полок разной глубины',{skip:!existsSync(`${ETALON}/k31.json`)},()=>{
  const ref=load('k31','m01');
  const {module:m}=moduleFromEtalon(ref);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.sections[0].doorNiche,1018.5);
  const c=compareModule(ref,m);
  const doors=c.pairs.filter(p=>p.ref.cls.startsWith('фасад'));
  assert.equal(doors.length,ref.panels.filter(p=>p.name==='Дверь').length);
  for(const p of doors)assert.ok(p.delta<=0.5,p.ref.name+' Δ'+p.delta);
  assert.ok(!c.missing.some(x=>x.cls.startsWith('фасад'))&&!c.extra.some(x=>x.cls.startsWith('фасад')));
  const h=c.hardware.find(x=>x.category==='петля')!;
  assert.deepEqual([h.ref,h.studio,h.maxPosDelta],[4,4,0]);
  const r=c.hardware.find(x=>x.category==='рафикс')!;
  assert.deepEqual([r.ref,r.studio],[12,12]);
  // ниша в студии: верхний ряд выше верха нижнего ровно на высоту ниши
  const ps=parts(m),dd=ps.filter(p=>p.role==='door').sort((a,b)=>a.position[1]-b.position[1]);
  const top0=dd[0].position[1]+dd[0].size[1]/2,bot1=dd[dd.length-1].position[1]-dd[dd.length-1].size[1]/2;
  assert.equal(Math.round((bot1-top0)*10)/10,1018.5);
});

test('пенал в 3 ряда распашных (doorRows): нижний 824,5, средний 1135, верхний до верха, зазор 3; петли по правилу по высоте ряда',()=>{
  const t={...initialModule(),height:2470.5,width:680,depth:600,kitchen:{role:'tall' as const}};t.sections=[{...t.sections[0],doorLeaves:1 as const,doorSplit:826,doorRows:[1135]}];t.faceGapBetween=3;
  assert.deepEqual(validate(t),[]);
  const dd=parts(t).filter(p=>p.role==='door').sort((a,b)=>a.position[1]-b.position[1]);
  assert.equal(dd.length,3);
  assert.deepEqual(dd.slice(0,2).map(p=>Math.round(p.size[1]*10)/10),[824.5,1135]);
  assert.equal(Math.round((dd[1].position[1]-dd[1].size[1]/2-(dd[0].position[1]+dd[0].size[1]/2))*10)/10,3);
  assert.equal(Math.round((dd[2].position[1]-dd[2].size[1]/2-(dd[1].position[1]+dd[1].size[1]/2))*10)/10,3);
  const hinges=parts(t).filter(p=>p.id.includes(':hingeplate:'));
  assert.equal(hinges.length,2+3+2,'824,5 → 2, 1135 → 3, верхний ≤ 900 → 2 (как 7 петель k05 m01)');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(t))).sections[0].doorRows,[1135]);
  const w={...t};delete (w as Partial<typeof t>).kitchen;
  assert.ok(validate(w as typeof t).some(e=>e.includes('ряды фасадов')),'у шкафа doorRows нет');
});

test('распознавание рядов: k05 m01 — 3 ряда по одной створке (826 + средний 1135), k24 m04 — 3 ряда; ряды с ящиками не трогаем',{skip:!existsSync(`${ETALON}/k05.json`)},()=>{
  const a=moduleFromEtalon(load('k05','m01'));
  assert.deepEqual([a.module.sections[0].doorSplit,a.module.sections[0].doorRows,a.module.sections[0].doorNiche],[826,[1135],undefined]);
  assert.ok(!a.unsupported.some(u=>u.startsWith('фасады в')),a.unsupported.join('; '));
  const b=moduleFromEtalon(load('k24','m04'));
  assert.equal(b.module.sections[0].doorRows?.length,1);
  const c=moduleFromEtalon(load('k28','m03'));
  assert.equal(c.module.sections[0].doorRows,undefined,'ящики Axis + двери — не ряды распашных');
});

test('фасад без петель (hingeless, кухня): петли не ставятся и не идут в смету; жёсткая полка без крепежа (bareShelves) — без конфирматов',()=>{
  const t={...initialModule(),height:2100,kitchen:{role:'tall' as const}};t.sections=[{...t.sections[0],doorLeaves:1 as const,doorSplit:1300,hingeless:[0],shelves:[0.5],fixed:[0]}];
  assert.deepEqual(validate(t),[]);
  const ps=parts(t),sid=t.sections[0].id;
  assert.equal(ps.filter(p=>p.id.startsWith(`${sid}:hingeplate:0:`)).length,0,'нижний фасад (холодильник) без петель');
  assert.ok(ps.filter(p=>p.id.startsWith(`${sid}:hingeplate:2:`)).length>0,'верхний — на петлях');
  assert.ok(ps.find(p=>p.id===`${sid}:door:0`)?.hingeless);
  const nHinges=(m:typeof t)=>estimate(newProject(m)).lines.filter(l=>l.id.startsWith('hinge')).reduce((s,l)=>s+l.quantity,0);
  const withHinges={...t,sections:[{...t.sections[0],hingeless:undefined}]};
  assert.ok(nHinges(t)<nHinges(withHinges),'смета: петель нижнего фасада нет');
  assert.ok(ps.some(p=>p.id.startsWith('fast:')&&p.id.includes(':shelf:0:')));
  const bare={...t,kitchen:{...t.kitchen,bareShelves:[0]}};
  assert.equal(parts(bare).filter(p=>p.id.includes(':shelf:0:')&&/^(fast|ecc|rafix):/.test(p.id)).length,0);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(bare))).kitchen?.bareShelves,[0]);
  const w={...t};delete (w as Partial<typeof t>).kitchen;
  assert.ok(validate(w as typeof t).some(e=>e.includes('без петель')),'у шкафа hingeless нет');
});

test('распознавание: фасад холодильника без петель k25 m10 (петли 2/2, опоры 4/4 — ряды опор со сдвигом 1 мм не удваиваются), пустой пенал k23 m14 — двери без петель, полки без крепежа',{skip:!existsSync(`${ETALON}/k25.json`)},()=>{
  assert.deepEqual(clusterLegXs([69,70,530,531]),[69.5,530.5]);
  const ref=load('k25','m10'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(m.sections[0].hingeless,[0]);
  const c=compareModule(ref,m),row=(k:string)=>c.hardware.find(h=>h.category===k)!;
  assert.deepEqual([row('петля').ref,row('петля').studio],[2,2]);
  assert.deepEqual([row('опора').ref,row('опора').studio],[4,4]);
  const r2=load('k23','m14'),{module:m2}=moduleFromEtalon(r2);
  assert.equal(m2.doors,true);
  assert.ok((m2.kitchen?.bareShelves?.length??0)>0);
  const c2=compareModule(r2,m2);
  assert.ok(!c2.missing.some(x=>x.cls.startsWith('фасад')),'двери есть');
  assert.equal(c2.hardware.find(h=>h.category==='петля'),undefined,'петель нет ни в Базисе, ни в студии');
  // полки с зазором у стоек без полкодержателей и крепежа — съёмные без фурнитуры, полкодержателей студия не добавляет
  assert.equal(c2.hardware.find(h=>h.category==='полкодержатель'),undefined);
  assert.equal(parts(m2).filter(p=>p.id.startsWith('shp:')).length,0);
  assert.ok((m2.sections[0].fixed??[]).length<m2.sections[0].shelves.length,'съёмные полки не записаны в жёсткие');
});

test('фасады без петель — только когда ряды и створки Базиса совпадают с дверями студии: фасад ящика, «Front», «Фронтальная» в общем ряду не снимают петли (критик n3)',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const B=(x0:number,y0:number,x1:number,y1:number)=>({x0,y0,z0:0,x1,y1,z1:18});
  const doorL=B(0,100,500,2000),doorR=B(503,100,1000,2000),drawer=B(300,100,700,300);
  assert.deepEqual(hingelessDoors([[doorL,drawer,doorR]],[{pos:[16,200,0]},{pos:[984,200,0]}],2),[],'фасад ящика в ряду — номера не те, петли не снимаем');
  assert.deepEqual(hingelessDoors([[doorL,doorR]],[{pos:[16,200,0]}],2,3),[],'есть другие фасады — не снимаем');
  assert.deepEqual(hingelessDoors([[doorL,doorR]],[{pos:[16,200,0]}],2),[1],'две створки, петли только у левой');
  assert.deepEqual(hingelessDoors([[doorL],[B(0,2003,500,2400)]],[{pos:[16,200,0]},{pos:[100,5000,0]}],1),[],'петля Базиса не на створках — распознавание неоднозначно');
  // было: k30 m15 петли 12/6, k28 m15 6/0, k28 m03 4/0, k27 m08 3/0 — студия снимала петли, которые в Базисе есть
  for(const [k,key] of [['k30','m15'],['k28','m15'],['k28','m03'],['k27','m08']]){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.equal(m.sections[0].hingeless,undefined,k+key);
    const h=compareModule(ref,m).hardware.find(x=>x.category==='петля')!;
    assert.ok(h.studio>=h.ref,`${k} ${key}: петли ${h.ref}/${h.studio}`);
  }
  const ref=load('k30','m15'),h30=compareModule(ref,moduleFromEtalon(ref).module).hardware.find(x=>x.category==='петля')!;
  assert.deepEqual([h30.ref,h30.studio],[12,12]);
});

test('пенал в 3 ряда: петли по рядам — средний по правилу или hingeYMid, верхний — hingeYUp (не высоты среднего ряда); при смене высоты петли не сбиваются, верхний ряд < 200 — ошибка (критик n3)',()=>{
  const m=kitchenBase(initialModule(),600);m.kitchen={...m.kitchen!,role:'tall'};m.height=2700;
  const s=m.sections[0];s.shelves=[];s.doorLeaves=1;s.doorSplit=718.5;s.doorRows=[1241];
  const top=parts(m).find(p=>p.id===`${s.id}:door:4`)!;assert.ok(top,'верхний фасад — створка 4');
  s.hingeYUp=[100,top.size[1]-303];s.hingeYUpFor=top.size[1];
  assert.deepEqual(validate(m),[]);
  const rel=(mm:typeof m,k:number)=>{const ps=parts(mm),d=ps.find(p=>p.id===`${s.id}:door:${k}`)!,y0=d.position[1]-d.size[1]/2;return ps.filter(p=>p.id.startsWith(`${s.id}:hingecup:${k}:`)).map(p=>Math.round((p.position[1]-y0)*10)/10).sort((a,b)=>a-b);};
  assert.deepEqual(rel(m,2),[100,620.5,1141],'средний 1241 — по правилу кухни (3 петли), не hingeYUp');
  assert.deepEqual(rel(m,4),[100,Math.round((top.size[1]-303)*10)/10],'верхний — 2 петли по hingeYUp');
  // свои высоты среднего ряда
  const mid={...m,sections:[{...s,hingeYMid:[[150,700,1100]],hingeYMidFor:[1241]}]};
  assert.deepEqual(validate(mid),[]);
  assert.deepEqual(rel(mid,2),[150,700,1100]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(mid))).sections[0].hingeYMid,[[150,700,1100]]);
  // ниже на 300/400: петли верхнего фасада по порядку, внутри фасада, не ближе планки; пересечений петель нет
  for(const dH of [-300,-400]){
    const n={...m,height:m.height+dH};
    assert.deepEqual(validate(n),[],String(dH));
    for(const k of [0,2,4]){const ys=rel(n,k);assert.ok(ys.length>=2&&ys.every((y,i)=>y>0&&(i===0||y-ys[i-1]>=53)),`${dH} створка ${k}: ${ys}`);}
    assert.equal(rel(n,4).length,2,'у низкого верхнего фасада 2 петли');
    assert.deepEqual(partCollisions(parts(n),n).filter(c=>/hinge/.test(c.a)||/hinge/.test(c.b)),[],String(dH));
  }
  // верхний ряд меньше 200 мм — ошибка проверки (раньше молчала: считалось от высоты корпуса)
  assert.ok(validate({...m,height:m.height-450}).some(e=>e.includes('верхний ряд фасадов')));
  // высоты проекта под другую высоту фасада (k04 m07: hingeY 490,5/490,5/982,5/982,5 при 497 на фасаде 997) — не вне фасада и не друг в друге, а по правилу
  const w=kitchenBase(initialModule(),600);w.height=1000;w.sections[0].shelves=[];w.sections[0].hingeY=[490.5,490.5,982.5,982.5];w.sections[0].hingeYFor=497;
  const wd=parts(w).find(p=>p.role==='door'&&p.id.endsWith(':door:0'))!;
  const ps=parts(w),y0=wd.position[1]-wd.size[1]/2,cy=ps.filter(p=>p.id.startsWith(wd.id.replace(':door:',':hingecup:')+':')).map(p=>p.position[1]-y0).sort((a,b)=>a-b);
  assert.ok(cy.length>=2&&cy.every((y,i)=>y>0&&y<wd.size[1]&&(i===0||y-cy[i-1]>=53)),String(cy));
  assert.equal(cy.length,2,'столько петель, сколько разных высот в проекте (490,5 и 982,5), а не по правилу (3) — студия не добавляет петель');
  // при высоте фасада как в проекте — высоты Базиса как есть
  const same={...w,sections:[{...w.sections[0],hingeY:[100,300],hingeYFor:wd.size[1]}]};
  const ps2=parts(same);assert.deepEqual(ps2.filter(p=>p.id.startsWith(wd.id.replace(':door:',':hingecup:')+':')).map(p=>Math.round(p.position[1]-y0)).sort((a,b)=>a-b),[100,300]);
});

test('k24 m04: пенал в 3 ряда — петли 7 из 7 по рядам Базиса (100/567, 100/620,5/1141, 100/333)',{skip:!existsSync(`${ETALON}/k24.json`)},()=>{
  const ref=load('k24','m04'),{module:m}=moduleFromEtalon(ref),s=m.sections[0];
  assert.deepEqual(s.doorRows,[1241]);
  assert.deepEqual(s.hingeYUp,[100,333],'верхний ряд — свои высоты, не среднего');
  assert.equal(s.hingeYMid,undefined,'средний — по правилу');
  const h=compareModule(ref,m).hardware.find(x=>x.category==='петля')!;
  assert.deepEqual([h.ref,h.studio],[7,7]);
  const ys=parts(m).filter(p=>p.id.includes(':hingeplate:')).map(p=>p.model!.origin![1]).sort((a,b)=>a-b);
  const ry=ref.hardware.filter(x=>x.category==='петля').map(x=>x.pos[1]).sort((a,b)=>a-b);
  ys.forEach((y,k)=>assert.ok(Math.abs(y-ry[k])<=1.5,`петля ${k}: ${y} против ${ry[k]}`));
});

test('цоколь — деталь под дном: у кухни без опор и без панели под приподнятым дном в Базисе (ниша под техникой) студия его не рисует (bareBottom, критик n3)',{skip:!existsSync(`${ETALON}/k18.json`)},()=>{
  for(const [k,key] of [['k18','m21'],['k23','m04'],['k30','m02']]){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.equal(m.kitchen?.bareBottom,true,k+key);
    assert.equal(parts(m).find(p=>p.id==='plinth'),undefined,k+key+': цоколя ~2 м нет');
    assert.ok(!compareModule(ref,m).extra.some(x=>x.name.startsWith('Цоколь')),k+key);
  }
  // панель под дном в Базисе есть («Фронтальная») — цоколь остаётся и сходится
  const r14=load('k14','m03'),{module:m14}=moduleFromEtalon(r14);
  assert.equal(m14.kitchen?.bareBottom,undefined);
  // имя — по Базису: поднятое дно навесного/пенала с панелью под ним (kitchen.raise.front, n3-wall) — «Фронтальная под дном»
  assert.ok(compareModule(r14,m14).pairs.some(p=>/^(Цоколь|Фронтальная под дном)/.test(p.studio.name)&&p.delta<=2));
  // поле сохраняется; у шкафа правило «низ без ножек — цоколь» прежнее
  const w=initialModule();w.plinthHeight=100;
  assert.ok(parts(w).some(p=>p.id==='plinth'));
  // пенал: без сведений о цоколе — с цоколем (n3-base); у навесного без lowFront/plinth цоколя нет и без поля (n3-plinth)
  const kk={...w,kitchen:{role:'tall' as const,bareBottom:true as const}};
  assert.ok(parts({...kk,kitchen:{role:'tall' as const}}).some(p=>p.id==='plinth'),'без поля — как раньше');
  assert.equal(parts(kk).find(p=>p.id==='plinth'),undefined);
  assert.equal(parseModule(JSON.parse(JSON.stringify(kk))).kitchen?.bareBottom,true);
  // низ кухни без опор — на высоте из Базиса (70, 2030 под нишей), список высот цоколя — только для шкафов
  const low={...kk,plinthHeight:70};
  assert.ok(!validate(low).some(e=>e.includes('высоту цоколя')),validate(low).join('; '));
  assert.ok(validate({...w,plinthHeight:70}).some(e=>e.includes('высоту цоколя')),'у шкафа — из списка');
  assert.ok(!validate(moduleFromEtalon(load('k18','m21')).module).some(e=>e.includes('высоту цоколя')));
});

test('корпус без опор: низ фасадов как в Базисе (faceBottom) — над нишей под техникой от дна, а не у пола; дубль петли Базиса — одна высота (критик n3)',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const ref=load('k30','m02'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.faceBottom,1815.5);
  const dd=parts(m).filter(p=>p.role==='door');
  assert.ok(dd.length>0&&dd.every(d=>Math.abs(d.position[1]-d.size[1]/2-1815.5)<0.01&&Math.abs(d.size[1]-643)<0.6),dd.map(d=>d.size[1]).join(','));
  const h=compareModule(ref,m).hardware.find(x=>x.category==='петля')!;
  assert.deepEqual([h.ref,h.studio],[4,4],'было 4/12: двери до пола');
  // чужая «Фронтальная» вне габарита модуля (k18 m09) низ фасадов не сдвигает
  assert.equal(moduleFromEtalon(load('k18','m09')).module.kitchen?.faceBottom,undefined);
  // k01 m09: петля Базиса дважды в одной точке — студия ставит по 2 на створку (4), а не по 3 (6)
  const r1=load('k01','m09'),{module:m1}=moduleFromEtalon(r1);
  assert.deepEqual(m1.sections[0].hingeY,[219,375.5]);
  assert.equal(compareModule(r1,m1).hardware.find(x=>x.category==='петля')!.studio,4);
  // поле: только у кухни без опор
  const w={...initialModule(),kitchen:{role:'wall' as const,faceBottom:300}};
  assert.ok(!validate(w).some(e=>e.includes('Низ фасадов')));
  assert.ok(Math.abs(Math.min(...parts(w).filter(p=>p.role==='door').map(d=>d.position[1]-d.size[1]/2))-300)<0.01);
  assert.equal(parseModule(JSON.parse(JSON.stringify(w))).kitchen?.faceBottom,300);
});

test('дно/крыша без крепежа и отверстий у торцов в Базисе (k32 m01 — корпус под холодильник): студия не добавляет конфирматов (bareJoints, критик n3)',{skip:!existsSync(`${ETALON}/k32.json`)},()=>{
  const ref=load('k32','m01'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.bareJoints,['bottom','top']);
  assert.equal(parts(m).filter(p=>/^(fast|ecc|dowel):(bottom|top):/.test(p.id)).length,0);
  const c=compareModule(ref,m);
  assert.equal(c.hardware.find(h=>h.category==='конфирмат'),undefined,'конфирматов нет ни в Базисе, ни в студии');
  const w={...initialModule(),kitchen:{role:'wall' as const,bareJoints:['top' as const]}};
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(w))).kitchen?.bareJoints,['top']);
  assert.equal(parts(w).filter(p=>/^(fast|ecc|dowel):top:/.test(p.id)).length,0,'крыша без крепежа');
  assert.ok(parts(w).some(p=>/^(fast|ecc|dowel):bottom:/.test(p.id)),'дно — с крепежом');
  // у стыка есть крепёж другой категории или отверстия (k33 m03) — не «голый»
  const {module:m33}=moduleFromEtalon(load('k33','m03'));
  assert.equal(m33.kitchen?.bareJoints,undefined);
});

test('ниша под технику — только у кухни с разделёнными фасадами',()=>{
  const m=initialModule();m.sections[0].doorNiche=500;
  assert.ok(validate(m).some(e=>e.includes('ниша под технику')));
  const t={...initialModule(),height:2100,kitchen:{role:'tall' as const}};t.sections=[{...t.sections[0],doorSplit:800,doorNiche:600}];
  assert.deepEqual(validate(t),[]);
  const k=parseModule(JSON.parse(JSON.stringify(t)));
  assert.equal(k.sections[0].doorNiche,600,'сохраняется в проекте');
  const dd=parts(k).filter(p=>p.role==='door').sort((a,b)=>a.position[1]-b.position[1]);
  assert.equal(Math.round(dd[dd.length-1].position[1]-dd[dd.length-1].size[1]/2-(dd[0].position[1]+dd[0].size[1]/2)),600);
});

test('разрез фасадов (doorSplit) и «ниша под технику» распознаются только у пенала: антресоль/нижний — «не поддержано», пенал из двух корпусов — не разрез (критик n2)',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  // k13 m02 — два ряда подъёмных фасадов, поддержано (n3, tests/kitchen-antresol.test.ts); два ряда распашных — нет
  for(const [k,key] of [['k27','m12'],['k10','m11']]){
    const {module:m,unsupported}=moduleFromEtalon(load(k,key));
    assert.equal(m.sections[0].doorSplit,undefined,k+key);
    // k10 m11 — два ящика Versalite Light H45 (n3): фасады распознаны как ящики, а не «2 ряда»
    if(k==='k10')assert.ok(m.kdrawers?.length===2&&m.kdrawers.every(d=>d.system==='versalite-h45'),k+key+': ящики Versalite');
    else assert.ok(unsupported.some(u=>u.startsWith('фасады в 2 ряда')),k+key+': '+unsupported.join('; '));
    assert.ok(!unsupported.some(u=>u.startsWith('ниша под технику')),k+key+': ниша — только у пенала');
  }
  const {module:p,unsupported:u30}=moduleFromEtalon(load('k30','m05'));
  assert.equal(p.sections[0].doorSplit,undefined,'боковины 850, фасады до 2469 — не разрез');
  assert.ok(u30.some(u=>u.startsWith('фасады пенала выше боковин')),u30.join('; '));
});

test('кромка фикс. полки «перед+зад» — только у полки на эксцентриках (k12 m04); фикс. полки k16 m01 (P8–P14) — по кругу, кромка сходится с Базисом (критик n2)',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const ref16=load('k16','m01'),{module:m16}=moduleFromEtalon(ref16);
  const c16=compareModule(ref16,m16);
  assert.deepEqual(c16.edges?.bad??[],[],'кромка k16 m01 совпадает с Базисом');
  const {module:m12}=moduleFromEtalon(load('k12','m04'));
  const s=m12.sections[0],ids=(s.fixed??[]).map(j=>`${s.id}:shelf:${j}`);
  assert.ok(ids.length>0);
  for(const id of ids)assert.deepEqual(Object.keys(edgeByDir(parts(m12).find(p=>p.id===id)!)).sort(),['+z','-z'],'эксцентрики: перед и зад');
  const conf={...m12,jointFastening:Object.fromEntries(Object.entries(m12.jointFastening??{}).map(([k])=>[k,'confirmat' as const]))};
  for(const id of ids)assert.deepEqual(Object.keys(edgeByDir(parts(conf).find(p=>p.id===id)!)).sort(),['+x','+z','-x','-z'],'не эксцентрики: по кругу');
});

test('пенал: hingeYUp — свои высоты петель у верхнего ряда (doorSplit), нижний ряд — по правилу; parseModule сохраняет поля',()=>{
  const m=kitchenBase(initialModule(),600);m.kitchen={...m.kitchen!,role:'tall'};m.height=2100;
  const s=m.sections[0];s.shelves=[];s.doorSplit=1000;
  const up=parts(m).find(p=>p.id===`${s.id}:door:2`)!;assert.ok(up,'верхний фасад');
  const dh=up.size[1];s.hingeYUp=[100,400,700,dh-100];s.hingeYUpFor=dh;
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),cups=(k:number)=>ps.filter(p=>p.id.startsWith(`${s.id}:hingecup:${k}:`));
  const y0=up.position[1]-dh/2;
  assert.deepEqual(cups(2).map(p=>Math.round(p.position[1]-y0)).sort((a,b)=>a-b),[100,400,700,Math.round(dh-100)],'верхний ряд — по hingeYUp');
  assert.ok(cups(0).length>=2&&cups(0).length<=3,'нижний ряд — по правилу кухни');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.sections[0].hingeYUp,s.hingeYUp);assert.equal(back.sections[0].hingeYUpFor,dh);
});
