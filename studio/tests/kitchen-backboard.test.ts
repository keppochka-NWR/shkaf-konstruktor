import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule,rearClear} from '../src/model';
import {kitchenWall,mirrorKitchen} from '../src/kitchen';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';

// Пакет 4 развития калькулятора: задник из ЛДСП у кухни Базиса (backlog F_BACK_LDSP) — kitchen.backBoard: вкладной, утопленный,
// на рафиксах по сетке от кромок задника (правило «от кромки», пакет 0). Эталоны вне репозитория — тесты с ними пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2),edges:c.edges?.bad.slice(0,3),holes:[...(c.holes?.missing.slice(0,3)??[]),...(c.holes?.extra.slice(0,3)??[])]});
const pass=(k:string,key:string)=>{const ref=load(k,key);const r=moduleFromEtalon(ref);const err=validate(r.module);const c=compareModule(ref,r.module);return {ok:honestPass(c,err,r.unsupported),m:r.module,info:why(c)+JSON.stringify(err)+JSON.stringify(r.unsupported)};};

// антресоль k18 m16 своими словами: 800×510×330, задник ЛДСП утоплен на 100, крыша перед ним, 8 рафиксов (2 в боковину, 2 в дно, 2 в крышу со сдвигом 100), «8» с лица
function antresol(){
  const m=kitchenWall(initialModule(),800);m.name='А синт.';m.height=510;m.depth=330;m.kitchen={role:'antresol',topBack:100,backBoard:{inset:100,rafix:{side:{rear:63,front:63,n:2},bottom:{rear:64,front:64,n:2},top:{rear:64,front:64,n:2},topShift:100,caps:true}}};
  m.backType='board';m.sections[0].shelves=[];m.sections[0].shelfDepth=200;m.sections[0].drawers=0;m.doors=false;m.edgeScheme={t:1};m.bazis=true;m.confirmatInset=51;
  return m;
}
const byId=(m:ReturnType<typeof antresol>,id:string)=>parts(m).find(p=>p.id===id)!;
const box=(p:{size:number[];position:number[]})=>p.position.map((v,i)=>[+(v-p.size[i]/2).toFixed(1),+(v+p.size[i]/2).toFixed(1)]);

test('backBoard: задник ЛДСП между боковинами, дном и крышей, тыльная пласть на inset от задней кромки; крыша перед ним (topBack); шкаф студии — как прежде',()=>{
  const m=antresol(),bk=byId(m,'back'),top=byId(m,'top');
  assert.deepEqual(bk.size,[768,478,16]);assert.deepEqual(box(bk),[[16,784],[16,494],[100,116]]);
  assert.equal(bk.material,'board');assert.deepEqual(bk.edge,[0,0,0,0],'без кромки (k18); по кругу — через edgeScheme.parts');
  assert.deepEqual(box(top)[2],[100,330],'крыша короче сзади — перед задником');
  assert.equal(rearClear(m),117,'внутренняя глубина — от лицевой пласти задника (полки k01 m08: shelfRear −1)');
  assert.deepEqual(validate(m),[]);
  // шкаф студии с задником ЛДСП — та же деталь, что и раньше (снимок шкафов)
  const w=initialModule();w.backType='board';const wb=parts(w).find(p=>p.id==='back')!;
  assert.deepEqual(box(wb)[2],[0,16]);assert.equal(wb.size[0],w.width-32);assert.deepEqual(wb.edge,[0.4,0.4,0.4,0.4]);assert.equal(rearClear(w),17);
});

test('backBoard: рафиксы и «8» — по сетке от кромок задника, присадка как в Базисе (k18): корпус D20×13 с тыла, шток D5×13 в стойку в 8 от тыла',()=>{
  const m=antresol(),ps=parts(m),rf=ps.filter(p=>p.id.startsWith('rafix:back:')&&!p.id.endsWith(':pin')),caps=ps.filter(p=>p.id.startsWith('kitchen-back-cap:'));
  assert.equal(rf.length,8);assert.equal(caps.length,8);
  assert.deepEqual(rf.map(p=>p.anchor),[[16,79,100],[16,431,100],[784,79,100],[784,431,100],[80,16,100],[720,16,100],[80,494,200],[720,494,200]]);
  const hs=holes(m,ps),h=(src:string)=>hs.filter(x=>x.src===src).map(x=>[x.part,...x.at,...x.dir,x.d,x.depth]);
  assert.deepEqual(h('rafix:back:left:0'),[['back',25.5,79,100,0,0,1,20,13]]);
  assert.deepEqual(h('rafix:back:left:0:side'),[['left',16,79,108,-1,0,0,5,13]]);
  assert.deepEqual(h('rafix:back:right:1'),[['back',774.5,431,100,0,0,1,20,13]]);
  assert.deepEqual(h('rafix:back:bottom:0'),[['back',80,25.5,100,0,0,1,20,13]]);
  assert.deepEqual(h('rafix:back:bottom:0:side'),[['bottom',80,16,108,0,-1,0,5,13]]);
  assert.deepEqual(h('rafix:back:top:1'),[],'верхний рафикс в проекте Базиса на 100 дальше задника — корпуса в задник нет (как в Базисе, panel None)');
  assert.deepEqual(h('rafix:back:top:1:side'),[['top',720,494,208,0,1,0,5,13]]);
  assert.deepEqual(h('kitchen-back-cap:left:0'),[['back',25.5,79,116,0,0,-1,8,16]]);
  assert.deepEqual(partCollisions(ps,m).filter(c=>!c.bazis).map(c=>c.names.join('×')),[]);
});

test('backBoard: правило «от кромки» — смена ширины и высоты не ломает сетку (пакет 0), зеркало меняет сетки дна/крыши местами, parse держит поле',()=>{
  const m=antresol(),anchors=(mm:typeof m)=>parts(mm).filter(p=>p.id.startsWith('rafix:back:')&&!p.id.endsWith(':pin')).map(p=>p.anchor);
  assert.deepEqual(anchors({...m,width:900}),[[16,79,100],[16,431,100],[884,79,100],[884,431,100],[80,16,100],[820,16,100],[80,494,200],[820,494,200]]);
  assert.deepEqual(anchors({...m,height:610}),[[16,79,100],[16,531,100],[784,79,100],[784,531,100],[80,16,100],[720,16,100],[80,594,200],[720,594,200]]);
  for(const mm of [{...m,width:900},{...m,width:700},{...m,height:610},{...m,height:410}]){assert.deepEqual(validate(mm),[]);assert.deepEqual(partCollisions(parts(mm),mm).filter(c=>!c.bazis).map(c=>c.names.join('×')),[]);}
  const a=structuredClone(m);a.kitchen!.backBoard!.rafix!.bottom={rear:40,front:90,n:2};mirrorKitchen(a);
  assert.deepEqual(a.kitchen!.backBoard!.rafix!.bottom,{rear:90,front:40,n:2});
  const r=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(r.kitchen!.backBoard,m.kitchen!.backBoard);assert.equal(r.backType,'board');
  const bad=structuredClone(m);bad.kitchen!.backBoard!.inset=320;assert.ok(validate(bad).some(e=>/Задник ЛДСП/.test(e)));
});

test('backBoard: k18 m18 и k01 m08 из Базиса — PASS; k18 m17 — дно перед задником на 150; k27 m08 — задник на части высоты честно не поддержан',{skip:!has('k18')||!has('k01')||!has('k27')},()=>{
  const a=pass('k18','m18');assert.ok(a.ok,a.info);
  assert.deepEqual(a.m.kitchen!.backBoard,{inset:100,rafix:{side:{rear:63,front:63,n:2},bottom:{rear:64,front:64,n:2},top:{rear:64,front:64,n:2},caps:true}});
  assert.equal(a.m.kitchen!.topBack,100);
  // k18 m16: верхние рафиксы в проекте на 100 дальше тыльной пласти (topShift) — повторяем проект; сам модуль не PASS по другому (фасад Δ4,5, «3x3» газлифта)
  const e=moduleFromEtalon(load('k18','m16'));assert.equal(e.module.kitchen!.backBoard!.rafix!.topShift,100);
  const b=pass('k01','m08');assert.ok(b.ok,b.info);
  assert.deepEqual(b.m.kitchen!.backBoard,{inset:100,gap:{side:0.5,bottom:1,top:0.5}},'без крепежа, зазоры по проекту');
  assert.equal(b.m.shelfRear,-1);assert.equal(b.m.sections[0].shelfDepth,182);
  // k18 m17: задник на 150, дно перед ним (от 150), крыша — от 100, как в проекте; не PASS только из-за лишней записи «8» в проекте Базиса (19-я, в стороне от рафиксов — особенность данных)
  const c=pass('k18','m17');assert.ok(!c.ok&&/"прочее","ref":19,"studio":18/.test(c.info),c.info);
  assert.equal(c.m.kitchen!.backBoard!.inset,150);assert.equal(c.m.kitchen!.bottomBack,150);assert.equal(c.m.kitchen!.topBack,100);assert.deepEqual(validate(c.m),[]);
  const cc=compareModule(load('k18','m17'),c.m);assert.deepEqual([cc.missing.length,cc.extra.length,cc.holes?.missing.length,cc.holes?.extra.length],[0,0,0,0]);
  const d=moduleFromEtalon(load('k27','m08'));
  assert.ok(d.unsupported.some(u=>/задник ЛДСП на части высоты/.test(u)),d.unsupported.join('; '));assert.notEqual(d.module.backType,'board');
});
